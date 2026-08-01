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

// The other two surfaces whose copy changed when the hardcoded budget literals
// and the paper-detail 404 were replaced. Both now carry provenance sentences
// that a viewer reads, so they belong under the same gate.
const PROVENANCE_COPY_FILES = [
  'src/components/ModelsPanel.tsx',
  'src/app/(app)/paper/[uid]/page.tsx',
  'src/lib/paperDetail.ts',
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

function assertCopyGate(files: readonly string[]): void {
  for (const relativePath of files) {
    for (const value of literalCopy(relativePath)) {
      assert.equal(
        validateCopyString(value),
        true,
        relativePath + ' fails validateCopyString: ' + JSON.stringify(value),
      );
    }
  }
}

test('every literal on the brain-pipeline surface passes the non-diagnostic copy gate', () => {
  assertCopyGate(COPY_FILES);
});

test('the spend and paper-detail provenance copy passes the non-diagnostic gate', () => {
  assertCopyGate(PROVENANCE_COPY_FILES);
});
