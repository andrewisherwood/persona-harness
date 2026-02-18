import { Command } from "commander";
import { readFileSync, mkdirSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join, resolve } from "path";
import chalk from "chalk";
import type { Persona, Criterion, TestRunSummary } from "./personas/schema.js";
import { ModeBChatbotClient } from "./lib/chatbot-client.js";
import { simulateConversation } from "./lib/simulator.js";
import { evaluateConversation } from "./lib/judge.js";
import { calculateDensityScore } from "./lib/density.js";
import { buildPersonaSummary, generateMarkdownReport } from "./lib/reporter.js";
import { detectRegressions } from "./lib/regression.js";
import { UNIVERSAL_CRITERIA } from "./criteria/universal.js";
import type Anthropic from "@anthropic-ai/sdk";

const ROOT = resolve(import.meta.dirname ?? ".");

async function getCriteria(personaId: string, vertical: string): Promise<Criterion[]> {
  if (vertical === "birthbuild") {
    switch (personaId) {
      case "sparse-sarah": {
        const mod = await import("./criteria/birthbuild/sparse-sarah.js");
        return mod.SPARSE_SARAH_CRITERIA;
      }
      case "detailed-dina": {
        const mod = await import("./criteria/birthbuild/detailed-dina.js");
        return mod.DETAILED_DINA_CRITERIA;
      }
      case "nervous-nora": {
        const mod = await import("./criteria/birthbuild/nervous-nora.js");
        return mod.NERVOUS_NORA_CRITERIA;
      }
    }
  }
  throw new Error(`No criteria found for ${personaId} in vertical ${vertical}`);
}

function getPersonaFiles(vertical: string, personaId?: string): string[] {
  const dir = join(ROOT, "personas", vertical);
  if (personaId) return [join(dir, `${personaId}.json`)];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => join(dir, f));
}

function findLatestRun(): TestRunSummary | null {
  const runsDir = join(ROOT, "runs");
  if (!existsSync(runsDir)) return null;
  const dirs = readdirSync(runsDir).sort().reverse();
  for (const dir of dirs) {
    const summaryPath = join(runsDir, dir, "summary.json");
    if (existsSync(summaryPath)) {
      return JSON.parse(readFileSync(summaryPath, "utf-8")) as TestRunSummary;
    }
  }
  return null;
}

const program = new Command();
program
  .name("persona-harness")
  .description("Persona testing harness for chatbot evaluation")
  .version("0.1.0");

program
  .command("run")
  .description("Run persona simulations and evaluate")
  .requiredOption("--prompt <path>", "Path to system prompt file")
  .requiredOption("--tools <path>", "Path to tools JSON file")
  .option("--vertical <vertical>", "Run all personas for a vertical", "birthbuild")
  .option("--persona <id>", "Run a single persona")
  .option("--max-turns <n>", "Maximum conversation turns", "60")
  .option("--judge-model <model>", "Model for judge evaluator", "claude-opus-4-5-20250514")
  .option("--chatbot-model <model>", "Model for target chatbot", "claude-sonnet-4-5-20250929")
  .option("--persona-model <model>", "Model for persona simulator", "claude-sonnet-4-5-20250929")
  .action(async (opts) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error(chalk.red("Error: ANTHROPIC_API_KEY environment variable not set."));
      console.error(chalk.grey("Copy .env.example to .env and add your key."));
      process.exit(1);
    }

    const systemPrompt = readFileSync(resolve(opts.prompt), "utf-8");
    const tools = JSON.parse(readFileSync(resolve(opts.tools), "utf-8")) as Anthropic.Tool[];
    const maxTurns = parseInt(opts.maxTurns, 10);
    const vertical: string = opts.vertical;

    const personaFiles = getPersonaFiles(vertical, opts.persona);
    if (personaFiles.length === 0) {
      console.error(chalk.red(`No persona files found for vertical: ${vertical}`));
      process.exit(1);
    }

    const runId = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const runDir = join(ROOT, "runs", runId);
    mkdirSync(runDir, { recursive: true });

    console.log(chalk.bold(`\nPersona Testing Harness — ${vertical}`));
    console.log(chalk.grey(`Run ID: ${runId}`));
    console.log(chalk.grey(`Max turns: ${maxTurns}`));
    console.log(chalk.grey(`Personas: ${personaFiles.length}`));
    console.log("");

    const summaryPersonas: TestRunSummary["personas"] = {};

    for (const personaFile of personaFiles) {
      const persona = JSON.parse(readFileSync(personaFile, "utf-8")) as Persona;
      console.log(chalk.blue(`Simulating ${persona.name}...`));

      const chatbotClient = new ModeBChatbotClient({
        systemPrompt,
        tools,
        apiKey,
        model: opts.chatbotModel,
      });

      // Simulate conversation
      const { turns, finalSpec } = await simulateConversation({
        persona,
        chatbotClient,
        apiKey,
        maxTurns,
        personaModel: opts.personaModel,
      });

      console.log(chalk.grey(`  ${turns.length} turns completed`));

      // Save conversation and spec
      const personaDir = join(runDir, persona.id);
      mkdirSync(personaDir, { recursive: true });
      writeFileSync(join(personaDir, "conversation.json"), JSON.stringify(turns, null, 2));
      writeFileSync(join(personaDir, "spec-snapshot.json"), JSON.stringify(finalSpec, null, 2));

      // Evaluate
      console.log(chalk.blue(`  Evaluating with judge...`));
      const personaCriteria = await getCriteria(persona.id, vertical);
      const evaluation = await evaluateConversation({
        persona,
        turns,
        universalCriteria: UNIVERSAL_CRITERIA,
        personaCriteria,
        apiKey,
        model: opts.judgeModel,
      });

      writeFileSync(join(personaDir, "evaluation.json"), JSON.stringify(evaluation, null, 2));

      // Build summary
      const density = calculateDensityScore(finalSpec);
      summaryPersonas[persona.id] = buildPersonaSummary(evaluation, density, turns.length);

      const passed = summaryPersonas[persona.id]!.passed;
      const icon = passed ? chalk.green("PASS") : chalk.red("FAIL");
      console.log(`  ${icon} — Score: ${evaluation.overall_score}/5 | Density: ${density.totalScore}/25 (${density.level}) | Turns: ${turns.length}`);
      if (!passed && evaluation.hard_fails.length > 0) {
        console.log(chalk.red(`  Hard fails: ${evaluation.hard_fails.join(", ")}`));
      }
      console.log("");
    }

    // Regression detection
    const previousRun = findLatestRun();
    const currentSummary: TestRunSummary = {
      run_id: runId,
      timestamp: new Date().toISOString(),
      prompt_version: "manual",
      model: opts.chatbotModel,
      personas: summaryPersonas,
      regression: { detected: false, details: [] },
      overall_pass: Object.values(summaryPersonas).every((p) => p.passed),
    };

    if (previousRun) {
      currentSummary.regression = detectRegressions(currentSummary, previousRun);
      if (currentSummary.regression.detected) {
        currentSummary.overall_pass = false;
        console.log(chalk.red("Regressions detected:"));
        for (const detail of currentSummary.regression.details) {
          console.log(chalk.red(`  - ${detail}`));
        }
        console.log("");
      }
    }

    // Save summary and report
    writeFileSync(join(runDir, "summary.json"), JSON.stringify(currentSummary, null, 2));
    writeFileSync(join(runDir, "meta.json"), JSON.stringify({
      run_id: runId,
      timestamp: currentSummary.timestamp,
      prompt_version: "manual",
      model: opts.chatbotModel,
      judge_model: opts.judgeModel,
      persona_model: opts.personaModel,
      max_turns: maxTurns,
      vertical,
    }, null, 2));

    const markdownReport = generateMarkdownReport(currentSummary);
    writeFileSync(join(runDir, "report.md"), markdownReport);

    console.log(chalk.bold("Summary:"));
    console.log(markdownReport);
    console.log(chalk.grey(`Results saved to: runs/${runId}/`));
  });

program
  .command("diff <run1> <run2>")
  .description("Compare two test runs for regressions")
  .action((run1Path: string, run2Path: string) => {
    const summary1 = JSON.parse(readFileSync(join(resolve(run1Path), "summary.json"), "utf-8")) as TestRunSummary;
    const summary2 = JSON.parse(readFileSync(join(resolve(run2Path), "summary.json"), "utf-8")) as TestRunSummary;

    const regression = detectRegressions(summary2, summary1);
    if (regression.detected) {
      console.log(chalk.red("Regressions detected:"));
      for (const detail of regression.details) {
        console.log(chalk.red(`  - ${detail}`));
      }
    } else {
      console.log(chalk.green("No regressions detected."));
    }
  });

program
  .command("report <run-dir>")
  .description("Generate a human-readable report for a run")
  .action((runDir: string) => {
    const summaryPath = join(resolve(runDir), "summary.json");
    if (!existsSync(summaryPath)) {
      console.error(chalk.red(`No summary.json found in ${runDir}`));
      process.exit(1);
    }
    const summary = JSON.parse(readFileSync(summaryPath, "utf-8")) as TestRunSummary;
    const md = generateMarkdownReport(summary);
    console.log(md);
  });

program.parse();
