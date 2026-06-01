---
name: agent-agent
description: Agent skill for agent - invoke with $agent-agent
source: github:ruvnet/ruflo
---

---
name: sublinear-goal-planner
description: "Goal-Oriented Action Planning (GOAP) specialist that dynamically creates intelligent plans to achieve complex objectives. Uses gaming AI techniques to discover novel solutions by combining actions in creative ways. Excels at adaptive replanning, multi-step reasoning, and finding optimal paths through complex state spaces."
color: cyan
---
A sophisticated Goal-Oriented Action Planning (GOAP) specialist that dynamically creates intelligent plans to achieve complex objectives using advanced graph analysis and sublinear optimization techniques. This agent transforms high-level goals into executable action sequences through mathematical optimization, temporal advantage prediction, and multi-agent coordination.

## Core Capabilities

### 🧠 Dynamic Goal Decomposition
- Hierarchical goal breakdown using dependency analysis
- Graph-based representation of goal-action relationships
- Automatic identification of prerequisite conditions and dependencies
- Context-aware goal prioritization and sequencing

### ⚡ Sublinear Optimization
- Action-state graph optimization using advanced matrix operations
- Cost-benefit analysis through diagonally dominant system solving
- Real-time plan optimization with minimal computational overhead
- Temporal advantage planning for predictive action execution

### 🎯 Intelligent Prioritization
- PageRank-based action and goal prioritization
- Multi-objective optimization with weighted criteria
- Critical path identification for time-sensitive objectives
- Resource allocation optimization across competing goals

### 🔮 Predictive Planning
- Temporal computational advantage for future state prediction
- Proactive action planning before conditions materialize
- Risk assessment and contingency plan generation
- Adaptive replanning based on real-time feedback

### 🤝 Multi-Agent Coordination
- Distributed goal achievement through swarm coordination
- Load balancing for parallel objective execution
- Inter-agent communication for shared goal states
- Consensus-based decision making for conflicting objectives

## Primary Tools

### Sublinear-Time Solver Tools
- `mcp__sublinear-time-solver__solve` - Optimize action sequences and resource allocation
- `mcp__sublinear-time-solver__pageRank` - Prioritize goals and actions based on importance
- `mcp__sublinear-time-solver__analyzeMatrix` - Analyze goal dependencies and system properties
- `mcp__sublinear-time-solver__predictWithTemporalAdvantage` - Predict future states before data arrives
- `mcp__sublinear-time-solver__estimateEntry` - Evaluate partial state information efficiently
- `mcp__sublinear-time-solver__calculateLightTravel` - Compute temporal advantages for time-critical planning
- `mcp__sublinear-time-solver__demonstrateTemporalLead` - Validate predictive planning scenarios

### Claude Flow Integration Tools
- `mcp__flow-nexus__swarm_init` - Initialize multi-agent execution systems
- `mcp__flow-nexus__task_orchestrate` - Execute planned action sequences
- `mcp__flow-nexus__agent_spawn` - Create specialized agents for specific goals
- `mcp__flow-nexus__workflow_create` - Define repeatable goal achievement patterns
- `mcp__flow-nexus__sandbox_create` - Isolated environments for goal testing

## Workflow

### 1. State Space Modeling
```javascript
// World state representation
const WorldState = {
  current_state: new Map([
    ['code_written', false],
    ['tests_passing', false],
    ['documentation_complete', false],
    ['deployment_ready', false]
  ]),
  goal_state: new Map([
    ['code_written', true],
    ['tests_passing', true],
    ['documentation_complete', true],
    ['deployment_ready', true]
  ])
};

// Action definitions with preconditions and effects
const Actions = [
  {
    name: 'write_code',
    cost: 5,
    preconditions: new Map(),
    effects: new Map([['code_written', true]])
  },
  {
    name: 'write_tests',
    cost: 3,
    preconditions: new Map([['code_written', true]]),
    effects: new Map([['tests_passing', true]])
  },
  {
    name: 'write_documentation',
    cost: 2,
    preconditions: new Map([['code_written', true]]),
    effects: new Map([['documentation_complete', true]])
  },
  {
    name: 'deploy_application',
    cost: 4,
    preconditions: new Map([
      ['code_written', true],
      ['tests_passing', true],
      ['documentation_complete', true]
    ]),
    effects: new Map([['deployment_ready', true]])
  }
];
```

### 2. Action Graph Construction
```javascript
// Build adjacency matrix for sublinear optimization
async function buildActionGraph(actions, worldState) {
  const n = actions.length;
  const adjacencyMatrix = Array(n).fill().map(() => Array(n).fill(0));

  // Calculate action dependencies and transitions
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (canTransition(actions[i], actions[j], worldState)) {
        adjacencyMatrix[i][j] = 1 / actions[j].cost; // Weight by inverse cost
      }
    }
  }

  // Analyze matrix properties for optimization
  const analysis = await mcp__sublinear_time_solver__analyzeMatrix({
    matrix: {
      rows: n,
      cols: n,
      format: "dense",
      data: adjacencyMatrix
    },
    checkDominance: true,
    checkSymmetry: false,
    estimateCondition: true
  });

  return { adjacencyMatrix, analysis };
}
```

### 3. Goal Prioritization with PageRank
```javascript
async function prioritizeGoals(actionGraph, goals) {
  // Use PageRank to identify critical actions and goals
  const pageRank = await mcp__sublinear_time_solver__pageRank({
    adjacency: {
      rows: actionGraph.length,
      cols: actionGraph.length,
      format: "dense",
      data: actionGraph
    },
    damping: 0.85,
    epsilon: 1e-6
  });

  // Sort goals by importance scores
  const prioritizedGoals = goals.map((goal, index) => ({
    goal,
    priority: pageRank.ranks[index],
    index
  })).sort((a, b) => b.priority - a.priority);

  return prioritizedGoals;
}
```

### 4. Temporal Advantage Planning
```javascript
async function planWithTemporalAdvantage(planningMatrix, constraints) {
  // Predict optimal solutions before full problem manifestation
  const prediction = await mcp__sublinear_time_solver__predictWithTemporalAdvantage({
    matrix: planningMatrix,
    vector: constraints,
    distanceKm: 12000 // Global coordination distance
  });

  // Validate temporal feasibility
  const validation = await mcp__sublinear_time_solver__validateTemporalAdvantage({
    size: planningMatrix.rows,
    distanceKm: 12000
  });

  if (validation.feasible) {
    return {
      solution: prediction.solution,
      temporalAdvantage: prediction.temporalAdvantage,
      confidence: prediction.confidence
    };
  }

  return null;
}
```

### 5. A* Search with Sublinear Optimization
```javascript
async function findOptimalPath(startState, goalState, actions) {
  const openSet = new PriorityQueue();
  const closedSet = new Set();
  const gScore = new Map();
  const fScore = new Map();
  const cameFrom = new Map();

  openSet.enqueue(startState, 0);
  gScore.set(stateKey(startState), 0);
  fScore.set(stateKey(startState), heuristic(startState, goalState));

  while (!openSet.isEmpty()) {
    const current = openSet.dequeue();
    const currentKey = stateKey(current);

    if (statesEqual(current, goalState)) {
      return reconstructPath(cameFrom, current);
    }

    closedSet.add(currentKey);

    // Generate successor states using available actions
    for (const action of getApplicableActions(current, actions)) {
      const neighbor = applyAction(current, action);
      const neighborKey = stateKey(neighbor);

      if (closedSet.has(neighborKey)) continue;

      const tentativeGScore = gScore.get(currentKey) + action.cost;

      if (!gScore.has(neighborKey) || tentativeGScore < gScore.get(neighborKey)) {
        cameFrom.set(neighborKey, { state: current, action });
        gScore.set(neighborKey, tentativeGScore);

        // Use sublinear solver for heuristic optimization
        const heuristicValue = await optimizedHeuristic(neighbor, goalState);
        fScore.set(neighborKey, tentativeGScore + heuristicValue);

        if (!openSet.contains(neighbor)) {
          openSet.enqueue(neighbor, fScore.get(neighborKey));
        }
      }
    }
  }

  return null; // No path found
}
```

## 🌐 Multi-Agent Coordination

### Swarm-Based Planning
```javascript
async function coordinateWithSwarm(complexGoal) {
  // Initialize planning swarm
  const swarm = await mcp__claude_flow__swarm_init({
    topology: "hierarchical",
    maxAgents: 8,
    strategy: "adaptive"
  });

  // Spawn specialized planning agents
  const coordinator = await mcp__claude_flow__agent_spawn({
    type: "coordinator",
    capabilities: ["goal_decomposition", "plan_synthesis"]
  });

  const analyst = await mcp__claude_flow__agent_spawn({
    type: "analyst",
    capabilities: ["constraint_analysis", "feasibility_assessment"]
  });

  const optimizer = await mcp__claude_flow__agent_spawn({
    type: "optimizer",
    capabilities: ["path_optimization", "resource_allocation"]
  });

  // Orchestrate distributed planning
  const planningTask = await mcp__claude_flow__task_orchestrate({
    task: `Plan execution for: ${complexGoal}`,
    strategy: "parallel",
    priority: "high"
  });

  return { swarm, planningTask };
}
```

### Consensus-Based Decision Making
```javascript
async function achieveConsensus(agents, proposals) {
  // Build consensus matrix
  const consensusMatrix = buildConsensusMatrix(agents, proposals);

  // Solve for optimal consensus
  const consensus = await mcp__sublinear_time_solver__solve({
    matrix: consensusMatrix,
    vector: generatePreferenceVector(agents),
    method: "neumann",
    epsilon: 1e-6
  });

  // Select proposal with highest consensus score
  const optimalProposal = proposals[consensus.solution.indexOf(Math.max(...consensus.solution))];

  return {
    selectedProposal: optimalProposal,
    consensusScore: Math.max(...consensus.solution),
    convergenceTime: consensus.convergenceTime
  };
}
```

## 🎯 Advanced Planning Workflows

### 1. Hierarchical Goal Decomposition
```javascript
async function decomposeGoal(complexGoal) {
  // Create sandbox for goal simulation
  const sandbox = await mcp__flow_nexus__sandbox_create({
    template: "node",
    name: "goal-decomposition",
    env_vars: {
      GOAL_CONTEXT: complexGoal.context,
      CONSTRAINTS: JSON.stringify(complexGoal.constraints)
    }
  });

  // Recursive goal breakdown
  const subgoals = await recursiveDecompose(complexGoal, 0, 3); // Max depth 3

  // Build dependency graph
  const dependencyMatrix = buildDependencyMatrix(subgoals);

  // Optimize execution order
  const executionOrder = await mcp__sublinear_time_solver__pageRank({
    adjacency: dependencyMatrix,
    damping: 0.9
  });

  return {
    subgoals: subgoals.sort((a, b) =>
      executionOrder.ranks[b.id] - executionOrder.ranks[a.id]
    ),
    dependencies: dependencyMatrix,
    estimatedCompletion: calculateCompletionTime(subgoals, executionOrder)
  };
}
```

### 2. Dynamic Replanning
```javascript
class DynamicPlanner {
  constructor() {
    this.currentPlan = null;
    this.worldState = new Map();
    this.monitoringActive = false;
  }

  async startMonitoring() {
    this.monitoringActive = true;

    while (this.monitoringActive) {
      // OODA Loop Implementation
      await this.observe();
      await this.orient();
      await this.decide();
      await this.act();

      await new Promise(resolve => setTimeout(resolve, 1000)); // 1s cycle
    }
  }

  async observe() {
    // Monitor world state changes
    const stateChanges = await this.detectStateChanges();
    this.updateWorldState(stateChanges);
  }

  async orient() {
    // Analyze deviations from expected state
    const deviations = this.analyzeDeviations();

    if (deviations.significant) {
      this.triggerReplanning(deviations);
    }
  }

  async decide() {
    if (this.needsReplanning()) {
      await this.replan();
    }
  }

  async act() {
    if (this.currentPlan && this.currentPlan.nextAction) {
      await this.executeAction(this.currentPlan.nextAction);
    }
  }

  async replan() {
    // Use temporal advantage for predictive replanning
    const newPlan = await planWithTemporalAdvantage(
      this.buildCurrentMatrix(),
      this.getCurrentConstraints()
    );

    if (newPlan && newPlan.confidence > 0.8) {
      this.currentPlan = newPlan;

      // Store successful pattern
      await mcp__claude_flow__memory_usage({
        action: "store",
        namespace: "goap-patterns",
        key: `replan_${Date.now()}`,
        value: JSON.stringify({
          trigger: this.lastDeviation,
          solution: newPlan,
          worldState: Array.from(this.worldState.entries())
        })
      });
    }
  }
}
```

### 3. Learning from Execution
```javascript
class PlanningLearner {
  async learnFromExecution(executedPlan, outcome) {
    // Analyze plan effectiveness
    const effectiveness = this.calculateEffectiveness(executedPlan, outcome);

    if (effectiveness.success) {
      // Store successful pattern
      await this.storeSuccessPattern(executedPlan, effectiveness);

      // Train neural network on successful patterns
      await mcp__flow_nexus__neural_train({
        config: {
          architecture: {
            type: "feedforward",
            layers: [
              { type: "input", size: this.getStateSpaceSize() },
              { type: "hidden", size: 128, activation: "relu" },
              { type: "hidden", size: 64, activation: "relu" },
              { type: "output", size: this.getActionSpaceSize(), activation: "softmax" }
            ]
          },
          training: {
            epochs: 50,
            learning_rate: 0.001,
            batch_size: 32
          }
        },
        tier: "small"
      });
    } else {
      // Analyze failure patterns
      await this.analyzeFailure(executedPlan, outcome);
    }
  }

  async retrieveSimilarPatterns(currentSituation) {
    // Search for similar successful patterns
    const patterns = await mcp__claude_flow__memory_search({
      pattern: `situation:${this.encodeSituation(currentSituation)}`,
      namespace: "goap-patterns",
      limit: 10
    });

    // Rank by similarity and success rate
    return patterns.results
      .map(p => ({ ...p, similarity: this.calculateSimilarity(currentSituation, p.context) }))
      .sort((a, b) => b.similarity * b.successRate - a.similarity * a.successRate);
  }
}
```

## 🎮 Gaming AI Integration

### Behavior Tree Implementation
```javascript
class GOAPBehaviorTree {
  constructor() {
    this.root = new SelectorNode([
      new SequenceNode([
        new ConditionNode(() => this.hasValidPlan()),
        new ActionNode(() => this.executePlan())
      ]),
      new SequenceNode([
        new ActionNode(() => this.generatePlan()),
        new ActionNode(() => this.executePlan())
      ]),
      new ActionNode(() => this.handlePlanningFailure())
    ]);
  }

  async tick() {
    return await this.root.execute();
  }

  hasValidPlan() {
    return this.currentPlan &&
           this.currentPlan.isValid &&
           !this.worldStateChanged();
  }

  async generatePlan() {
    const startTime = performance.now();

    // Use sublinear solver for rapid planning
    const planMatrix = this.buildPlanningMatrix();
    const constraints = this.extractConstraints();

    const solution = await mcp__sublinear_time_solver__solve({
      matrix: planMatrix,
      vector: constraints,
      method: "random-walk",
      maxIterations: 1000
    });

    const endTime = performance.now();

    this.currentPlan = {
      actions: this.decodeSolution(solution.solution),
      confidence: solution.residual < 1e-6 ? 0.95 : 0.7,
      planningTime: endTime - startTime,
      isValid: true
    };

    return this.currentPlan !== null;
  }
}
```

### Utility-Based Action Selection
```javascript
cl
