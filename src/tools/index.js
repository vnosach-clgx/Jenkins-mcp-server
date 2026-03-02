/**
 * Tool Registry - Central management of all MCP tools
 */

// Import all tool functions
import {
	triggerBuild,
	stopBuild,
	scheduleBuild,
	updateBuild,
	getBuildLog,
} from "./build-management.js";
import { getJob, getBuild, getJobs } from "./job-info.js";
import { whoAmI, getStatus } from "./system-info.js";
import {
	listBuildArtifacts,
	readBuildArtifact,
} from "./artifact-management.js";
import {
	cancelQueuedBuild,
	getQueueInfo,
	getQueueItem,
} from "./queue-management.js";

/**
 * Tool definitions with their schemas and handlers
 */
export const toolRegistry = {
	// Build Management Tools
	triggerBuild: {
		name: "triggerBuild",
		description:
			"Trigger a Jenkins job build with file and regular parameters",
		inputSchema: {
			type: "object",
			properties: {
				jobFullName: {
					type: "string",
					description: 'Jenkins job name (e.g., "PlaywrightBDD")',
				},
				parameters: {
					type: "object",
					description: "Build parameters including file paths",
					additionalProperties: true,
				},
			},
			required: ["jobFullName", "parameters"],
		},
		handler: triggerBuild,
	},

	stopBuild: {
		name: "stopBuild",
		description: "Stop/kill a running Jenkins build",
		inputSchema: {
			type: "object",
			properties: {
				jobFullName: {
					type: "string",
					description: "Full path of the Jenkins job",
				},
				buildNumber: {
					type: "integer",
					description:
						"Build number to stop (optional, defaults to last build)",
				},
			},
			required: ["jobFullName"],
		},
		handler: stopBuild,
	},

	scheduleBuild: {
		name: "scheduleBuild",
		description:
			"Schedule a Jenkins build with file and regular parameters to run at a specific time",
		inputSchema: {
			type: "object",
			properties: {
				jobFullName: {
					type: "string",
					description: 'Jenkins job name (e.g., "PlaywrightBDD")',
				},
				scheduleTime: {
					type: "string",
					description:
						"When to run the build (e.g., 'in 5 minutes', 'at 3:30 PM', '2024-12-20 15:30')",
				},
				parameters: {
					type: "object",
					description: "Build parameters including file paths",
					additionalProperties: true,
				},
				description: {
					type: "string",
					description: "Optional description for the scheduled build",
				},
			},
			required: ["jobFullName", "scheduleTime", "parameters"],
		},
		handler: scheduleBuild,
	},

	updateBuild: {
		name: "updateBuild",
		description: "Update build display name and/or description",
		inputSchema: {
			type: "object",
			properties: {
				jobFullName: {
					type: "string",
					description: "Full path of the Jenkins job",
				},
				buildNumber: {
					type: "integer",
					description:
						"Build number (optional, defaults to last build)",
				},
				displayName: {
					type: "string",
					description: "New display name for the build",
				},
				description: {
					type: "string",
					description: "New description for the build",
				},
			},
			required: ["jobFullName"],
		},
		handler: updateBuild,
	},

	// Job Information Tools
	getJob: {
		name: "getJob",
		description: "Get information about a Jenkins job",
		inputSchema: {
			type: "object",
			properties: {
				jobFullName: {
					type: "string",
					description: "Full path of the Jenkins job",
				},
			},
			required: ["jobFullName"],
		},
		handler: getJob,
	},

	getBuild: {
		name: "getBuild",
		description: "Get information about a specific build or the last build",
		inputSchema: {
			type: "object",
			properties: {
				jobFullName: {
					type: "string",
					description: "Full path of the Jenkins job",
				},
				buildNumber: {
					type: "integer",
					description:
						"Build number (optional, defaults to last build)",
				},
			},
			required: ["jobFullName"],
		},
		handler: getBuild,
	},

	getJobs: {
		name: "getJobs",
		description: "Get a paginated list of Jenkins jobs",
		inputSchema: {
			type: "object",
			properties: {
				parentFullName: {
					type: "string",
					description: "Full path of the parent folder (optional)",
				},
				skip: {
					type: "integer",
					description: "Number of items to skip (default: 0)",
				},
				limit: {
					type: "integer",
					description:
						"Maximum number of items to return (default: 10, max: 10)",
				},
			},
		},
		handler: getJobs,
	},

	// System Information Tools
	whoAmI: {
		name: "whoAmI",
		description: "Get information about the current authenticated user",
		inputSchema: {
			type: "object",
			properties: {},
		},
		handler: whoAmI,
	},

	getStatus: {
		name: "getStatus",
		description: "Get Jenkins instance status and health information",
		inputSchema: {
			type: "object",
			properties: {},
		},
		handler: getStatus,
	},

	// Artifact Management Tools
	listBuildArtifacts: {
		name: "listBuildArtifacts",
		description:
			"List all artifacts from a specific build or the last build",
		inputSchema: {
			type: "object",
			properties: {
				jobFullName: {
					type: "string",
					description: "Full path of the Jenkins job",
				},
				buildNumber: {
					type: "integer",
					description:
						"Build number (optional, defaults to last build)",
				},
			},
			required: ["jobFullName"],
		},
		handler: listBuildArtifacts,
	},

	readBuildArtifact: {
		name: "readBuildArtifact",
		description: "Read the content of a specific build artifact",
		inputSchema: {
			type: "object",
			properties: {
				jobFullName: {
					type: "string",
					description: "Full path of the Jenkins job",
				},
				artifactPath: {
					type: "string",
					description:
						'Relative path to the artifact (e.g., "target/app.jar", "reports/test.xml")',
				},
				buildNumber: {
					type: "integer",
					description:
						"Build number (optional, defaults to last build)",
				},
				format: {
					type: "string",
					enum: ["text", "base64"],
					description:
						"Format for returning binary files (default: text). Use base64 for binary files.",
				},
			},
			required: ["jobFullName", "artifactPath"],
		},
		handler: readBuildArtifact,
	},

	// Queue Management Tools
	cancelQueuedBuild: {
		name: "cancelQueuedBuild",
		description:
			"Cancel a pending/queued Jenkins build that hasn't started yet",
		inputSchema: {
			type: "object",
			properties: {
				jobFullName: {
					type: "string",
					description: "Full path of the Jenkins job",
				},
				queueId: {
					type: "integer",
					description:
						"Specific queue item ID to cancel (optional, cancels all queued items for the job if not provided)",
				},
			},
			required: ["jobFullName"],
		},
		handler: cancelQueuedBuild,
	},

	getQueueInfo: {
		name: "getQueueInfo",
		description: "Get information about queued builds",
		inputSchema: {
			type: "object",
			properties: {
				jobFullName: {
					type: "string",
					description:
						"Full path of the Jenkins job (optional, returns all queued items if not provided)",
				},
			},
		},
		handler: getQueueInfo,
	},

	getQueueItem: {
		name: "getQueueItem",
		description:
			"Get a specific queued item by queueId and see whether it transitioned to a build",
		inputSchema: {
			type: "object",
			properties: {
				queueId: {
					type: "integer",
					description: "Queue item ID (from triggerBuild result)",
				},
			},
			required: ["queueId"],
		},
		handler: getQueueItem,
	},

	// Log Management Tools
	getBuildLog: {
		name: "getBuildLog",
		description:
			"Get console log for a specific build or the last build. Supports optional line limiting from the start or tail of the log.",
		inputSchema: {
			type: "object",
			properties: {
				jobFullName: {
					type: "string",
					description: "Full path of the Jenkins job",
				},
				buildNumber: {
					type: "integer",
					description:
						"Build number (optional, defaults to last build)",
				},
				maxLines: {
					type: "integer",
					description:
						"Maximum number of lines to return. If omitted, returns full log.",
				},
				tail: {
					type: "boolean",
					description:
						"If true, returns the last maxLines lines instead of the first. Default: false.",
				},
			},
			required: ["jobFullName"],
		},
		handler: getBuildLog,
	},
};

/**
 * Get all tools for MCP server registration
 */
export function getAllTools() {
	return Object.values(toolRegistry).map(({ handler, ...tool }) => tool);
}

/**
 * Get tool handler by name
 */
export function getToolHandler(name) {
	return toolRegistry[name]?.handler;
}

/**
 * Check if a tool exists
 */
export function hasToolNamed(name) {
	return name in toolRegistry;
}
