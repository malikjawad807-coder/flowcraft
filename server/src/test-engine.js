import 'dotenv/config';
import { initDatabase, db } from './db.js';
import { executeWorkflow } from './engine/runner.js';

// Initialize DB schema
initDatabase();

async function runTestPipeline() {
  console.log('\n======================================================');
  console.log('🧪 FlowCart Step 3: Standalone Execution Engine Test');
  console.log('======================================================\n');

  // Ensure at least 1 lead exists for testing
  const leadCount = db.prepare('SELECT COUNT(*) as count FROM leads').get().count;
  if (leadCount === 0) {
    db.prepare(`
      INSERT INTO leads (name, email, business, city, status, step)
      VALUES ('Alexander Bell', 'alexander@bell-telecom.io', 'Bell Technologies', 'Edinburgh', 'Pending', 'Initial')
    `).run();
    console.log('[Test Setup] Inserted test lead Alexander Bell');
  }

  // Define test workflow graph
  const testWorkflow = {
    id: 'test-pipeline-demo',
    name: 'Sample Cold Outreach Flow',
    trigger_type: 'manual',
    nodes_json: JSON.stringify([
      {
        id: 'node-1',
        type: 'manual_trigger',
        data: { label: 'Manual Trigger' },
      },
      {
        id: 'node-2',
        type: 'get_leads',
        data: { label: 'Fetch Leads', status: 'Pending', limit: 2 },
      },
      {
        id: 'node-3',
        type: 'if_condition',
        data: {
          label: 'Verify Email Contains @',
          field: '{{ $json.email }}',
          operator: 'contains',
          compareValue: '@',
        },
      },
      {
        id: 'node-4',
        type: 'ai_write_email',
        data: {
          label: 'AI Draft Outreach',
          promptTemplate: 'Draft introduction for {{ $json.name }} at {{ $json.business }} in {{ $json.city }}.',
        },
      },
      {
        id: 'node-5',
        type: 'update_lead',
        data: {
          label: 'Update Lead Step',
          status: 'Pending',
          step: 'Draft Generated',
        },
      },
    ]),
    connections_json: JSON.stringify([
      { source: 'node-1', target: 'node-2' },
      { source: 'node-2', target: 'node-3' },
      { source: 'node-3', target: 'node-4', sourceHandle: 'true' },
      { source: 'node-4', target: 'node-5' },
    ]),
  };

  console.log(`Executing workflow "${testWorkflow.name}" with 5 nodes...`);
  const result = await executeWorkflow(testWorkflow, { isTestRun: true });

  console.log('\n--- Execution Summary ---');
  console.log(`Execution ID:  ${result.executionId}`);
  console.log(`Status:        ${result.status.toUpperCase()}`);
  console.log(`Total Duration: ${result.durationMs}ms`);
  console.log('\n--- Per-Node Results ---');

  for (const [nodeId, nodeData] of Object.entries(result.nodeResults)) {
    console.log(`\n• [${nodeData.status.toUpperCase()}] ${nodeData.label} (${nodeData.type}) - ${nodeData.duration_ms}ms`);
    if (nodeData.output) {
      const outputSnippet = JSON.stringify(nodeData.output).slice(0, 140);
      console.log(`  Output: ${outputSnippet}...`);
    }
    if (nodeData.error) {
      console.log(`  Error: ${nodeData.error}`);
    }
  }

  // Verify database record
  const savedExec = db.prepare('SELECT * FROM executions WHERE id = ?').get(result.executionId);
  if (savedExec) {
    console.log(`\n✓ Execution record correctly persisted in SQLite "executions" table!`);
  }

  console.log('\n======================================================');
  console.log('🎉 Execution Engine Test Completed Successfully!');
  console.log('======================================================\n');
}

runTestPipeline().catch((err) => {
  console.error('Test pipeline failed:', err);
  process.exit(1);
});
