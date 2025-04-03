#!/usr/bin/env node
/**
 * This is a template MCP server that implements a simple projects system.
 * It demonstrates core MCP concepts like resources and tools by allowing:
 * - Listing projects as resources
 * - Reading individual projects
 * - Creating new projects via a tool
 * - Summarizing all projects via a prompt
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListResourcesRequestSchema, ListToolsRequestSchema, ReadResourceRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { exec } from 'child_process';
/**
 * Simple in-memory storage for projects.
 * In a real implementation, this would likely be backed by a database.
 */
const projects = {
    "1": { title: "ts-polaris Project", path: "/Users/cosmoxu/Documents/code/work/github.com/lotusflare/ts-polaris" },
    "2": { title: "lua Project", path: "/Users/cosmoxu/Documents/code/work/github.com/lotusflare/lua" }
};
/**
 * Create an MCP server with capabilities for resources (to list/read projects),
 * tools (to create new projects), and prompts (to summarize projects).
 */
const server = new Server({
    name: "demo-mcp-server",
    version: "0.1.0",
}, {
    capabilities: {
        resources: {},
        tools: {},
        prompts: {},
    },
});
/**
 * Handler for listing available projects as resources.
 * Each project is exposed as a resource with:
 * - A project:// URI scheme
 * - Plain text MIME type
 * - Human readable name and description (now including the project title)
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
        resources: Object.entries(projects).map(([id, project]) => ({
            uri: `project:///${id}`,
            mimeType: "text/plain",
            name: project.title,
            description: `A text project: ${project.title}`
        }))
    };
});
/**
 * Handler for reading the paths of a specific project.
 * Takes a project:// URI and returns the project path as plain text.
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const url = new URL(request.params.uri);
    const id = url.pathname.replace(/^\//, '');
    const project = projects[id];
    if (!project) {
        throw new Error(`Project ${id} not found`);
    }
    return {
        contents: [{
                uri: request.params.uri,
                mimeType: "text/plain",
                text: project.path
            }]
    };
});
/**
 * Handler that lists available tools.
 * Exposes a single "create_project" tool that lets clients create new projects.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "create_project",
                description: "Create a new project",
                inputSchema: {
                    type: "object",
                    properties: {
                        title: {
                            type: "string",
                            description: "Title of the project"
                        },
                        path: {
                            type: "string",
                            description: "Text path of the project"
                        }
                    },
                    required: ["title", "path"]
                }
            },
            {
                name: "open_project",
                description: "Open a project from the file system. ",
                inputSchema: {
                    type: "object",
                    properties: {
                        path: {
                            type: "string",
                            description: "Path of the project"
                        }
                    },
                    required: ["path"]
                },
            }
        ]
    };
});
/**
 * Handler for the create_project tool.
 * Creates a new project with the provided title and path, and returns success message.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    switch (request.params.name) {
        case "create_project": {
            const title = String(request.params.arguments?.title);
            const path = String(request.params.arguments?.path);
            if (!title || !path) {
                throw new Error("Title and path are required");
            }
            const id = String(Object.keys(projects).length + 1);
            projects[id] = { title, path };
            return {
                contents: [{
                        type: "text",
                        text: `Created project ${id}: ${title}`
                    }]
            };
        }
        case "open_project": {
            const path = String(request.params.arguments?.path);
            if (!path) {
                throw new Error("Path is required");
            }
            // 根据操作系统使用不同的命令打开目录
            const openCommand = process.platform === 'win32'
                ? `explorer "${path}"`
                : process.platform === 'darwin'
                    ? `open "${path}"`
                    : `xdg-open "${path}"`;
            return new Promise((resolve, reject) => {
                exec(openCommand, (error) => {
                    if (error) {
                        reject(new Error(`Failed to open directory: ${error.message}`));
                        return;
                    }
                    resolve({
                        contents: [{
                                type: "text",
                                text: `Successfully opened directory: ${path}`
                            }]
                    });
                });
            });
        }
        default:
            throw new Error("Unknown tool");
    }
});
/**
 * Start the server using stdio transport.
 * This allows the server to communicate via standard input/output streams.
 */
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});
