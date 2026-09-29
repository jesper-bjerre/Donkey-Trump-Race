import axe from 'axe-core';

/** Runs axe-core against a rendered container and returns violation ids (empty when clean). */
export async function axeViolations(container: Element): Promise<string[]> {
  const results = await axe.run(container, {
    // jsdom cannot compute layout, so colour contrast is verified by the token contrast test instead.
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  return results.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
}
