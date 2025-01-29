const fs = require("fs");
const path = require("path");
const prettier = require("prettier");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;

const API_DOCS_OUTPUT = "docs.json";
const SOURCE_DIR = "../../blackthorn/events-webapp/srv";
const EXCLUDED_DIRS = ["node_modules", ".git", "dist"];

function extractApiCalls(filePath) {
  try {
    const code = fs.readFileSync(filePath, "utf8");
    const ast = parser.parse(code, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
    });

    const apiCalls = [];

    traverse(ast, {
      CallExpression(path) {
        const { node } = path;

        // detect calls using connect
        if (
          node.callee &&
          node.callee.object &&
          (node.callee.object.name === "connect" || 
          node.callee.object.name === "fetch")
        ) {
          const method = node.callee.property.name.toUpperCase();
          const urlArg = node.arguments[0];

          const url =
            urlArg && urlArg.type === "StringLiteral" ? urlArg.value : "";

          const options = node.arguments[1] || null;

          apiCalls.push({file: filePath, method, url, options });
        }
      },
    });

    return apiCalls;
  } catch (error) {
    console.error(`Error parsing file: ${filePath}: ${error.message}`);
    return [];
  }
}

function processDirectory(directory) {
  const apiCalls = [];

  fs.readdirSync(directory).forEach((file) => {
    const fullPath = path.join(directory, file);

    if (file.endsWith(".spec.ts")) return;

    if (EXCLUDED_DIRS.includes(file)) return;

    if (fs.statSync(fullPath).isDirectory()) {
      apiCalls.push(...processDirectory(fullPath));
    } else if (file.endsWith(".js") || file.endsWith(".ts")) {
      apiCalls.push(...extractApiCalls(fullPath));
    }
  });

  return apiCalls;
}

async function writeDocumentation(apiCalls) {
    try {
      return await prettier.format(JSON.stringify(apiCalls, null, 2), {
        parser: "json",
      });
    } catch (error) {
      console.error(`Error formatting JSON: ${error.message}`);
      return "[]"; // If error returns empty
    }
  }

async function generateDocumentation() {
  console.log("Scanning files...");
  const apiCalls = processDirectory(SOURCE_DIR);
  console.log(`Found ${apiCalls.length} API calls.`);
  const formatted = await writeDocumentation(apiCalls);
  fs.writeFileSync(API_DOCS_OUTPUT, formatted);       
}

generateDocumentation();
