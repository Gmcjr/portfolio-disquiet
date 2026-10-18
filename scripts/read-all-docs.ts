#!/usr/bin/env bun
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ---------- CONFIG ----------
const DOC_ROOT = 'docs';
// Required front‑matter keys for every markdown/YAML file (adjust as needed)
const REQUIRED = ['status', 'date'];
// ----------------------------

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.(md|markdown|yml|yaml)$/.test(entry.name)) yield full;
  }
}

function parseFrontMatter(text: string): Record<string, string> {
  const match = text.match(/^---\n([\s\S]+?)\n---/);
  if (!match) return {};
  try {
    const lines = match[1]!.split('\n');
    const out: Record<string, string> = {};
    for (const line of lines) {
      const [k, ...rest] = line.split(':');
      if (!k) continue;
      out[k.trim()] = rest.join(':').trim();
    }
    return out;
  } catch {
    return {};
  }
}

function validateAndPrint(file: string) {
  const raw = readFileSync(file, 'utf-8');
  const fm = parseFrontMatter(raw);
  const missing = REQUIRED.filter((k) => !(k in fm));
  if (missing.length) {
    console.log(`WARNING ${file} – missing front‑matter ${missing.join(', ')}`);
    console.log('--- FILE CONTENT START ---');
    console.log(raw);
    console.log('--- FILE CONTENT END ---\n');
  } else {
    console.log(`FILE ${file}`);
    console.log(JSON.stringify(fm, null, 2));
  }
}

for (const f of walk(DOC_ROOT)) {
  validateAndPrint(f);
}

// ----------- ROADMAP UPDATE (optional) -----------
function loadRoadmap(): string[] {
  const path = 'docs/ROADMAP.yaml';
  try {
    const raw = readFileSync(path, 'utf-8');
    return raw.split('\n');
  } catch {
    return [];
  }
}

function saveRoadmap(lines: string[]) {
  const path = 'docs/ROADMAP.yaml';
  writeFileSync(path, lines.join('\n'));
}

function updateRoadmap(phaseUpdates: Record<string, string>) {
  const lines = loadRoadmap();
  if (lines.length === 0) return; // no roadmap file
  const updated: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const nameMatch = line.match(/^\s*- name: (.+)$/);
    if (nameMatch) {
      const phaseName = (nameMatch[1] as string).trim();
      updated.push(line);
      i++;
      if (i < lines.length) {
        const statusLine = lines[i]!;
        const statusMatch = statusLine.match(/^(\s*)status: (.+)$/);
        if (statusMatch) {
          const indent = statusMatch[1];
          const newStatus = phaseUpdates[phaseName] || statusMatch[2];
          updated.push(`${indent}status: ${newStatus}`);
          i++;
          continue;
        }
      }
    }
    // otherwise just copy line
    updated.push(line);
    i++;
  }
  saveRoadmap(updated);
}

// Collect potential phase status changes from plan files
const phaseUpdates: Record<string, string> = {};
for (const f of walk(DOC_ROOT)) {
  if (!f.includes('/plans/')) continue; // only look at plan files
  const raw = readFileSync(f, 'utf-8');
  const fm = parseFrontMatter(raw);
  if (!fm.status) continue;
  // infer which phase this plan refers to – use filename tokens
  const base = f
    .split('/')
    .pop()!
    .replace(/\.[^.]+$/, '')
    .toLowerCase();
  const roadmapLines = loadRoadmap();
  for (const line of roadmapLines) {
    const nameMatch = line.match(/^\s*- name: (.+)$/);
    if (nameMatch) {
      const phaseName = (nameMatch[1] as string).trim();
      const slug = phaseName.toLowerCase().replace(/\s+/g, '');
      if (base.includes(slug)) {
        phaseUpdates[phaseName] = fm.status;
      }
    }
  }
}
if (Object.keys(phaseUpdates).length) {
  updateRoadmap(phaseUpdates);
}
// ---------------------------------------------------
