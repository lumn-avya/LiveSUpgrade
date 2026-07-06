import * as assert from "assert";
import * as vscode from "vscode";
import "mocha"; // <--- This forces the type definitions to load

suite("Extension Test Suite", () => {
  test("Extension should be present", () => {
    assert.ok(vscode.extensions.getExtension("local-dev-server"));
  });
});
