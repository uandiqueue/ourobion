import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import { validateCopyString } from '../../../shared/constants/copy_guidelines.ts';

const NAO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COPY_FILES = [
  'src/components/BrainPipelinePanel.tsx',
  'src/app/(app)/brain-pipeline/page.tsx',
  'src/components/SubNav.tsx',
] as const;

function literalCopy(relativePath: string): string[] {
  const sourceText = readFileSync(path.join(NAO_ROOT, relativePath), 'utf8');
  const source = ts.createSourceFile(
    relativePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const values: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isJsxText(node)
    ) {
      const value = node.text.replace(/\s+/g, ' ').trim();
      if (value !== '') values.push(value);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return values;
}

test('every literal on the brain-pipeline surface passes the non-diagnostic copy gate', () => {
  for (const relativePath of COPY_FILES) {
    for (const value of literalCopy(relativePath)) {
      assert.equal(
        validateCopyString(value),
        true,
        relativePath + ' fails validateCopyString: ' + JSON.stringify(value),
      );
    }
  }
});
