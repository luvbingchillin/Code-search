/**
 * Multi-signal intent classification for CodeSeek AI.
 * 
 * Replaces brittle exact-match regexes with semantic query classification
 * across repository-scope nouns, architectural question patterns, and natural
 * language inquiry phrasing.
 */

/**
 * Detects whether a user query is asking for a high-level architectural overview
 * of the active repository or codebase.
 *
 * Matches inquiries such as:
 * - "/overview", "overview"
 * - "what does this codebase do", "what is this codebase about"
 * - "what is this repo about", "explain this project"
 * - "how does this software work", "architecture of this repository"
 * - "tell me about this codebase", "give me an overview"
 */
export function detectOverviewIntent(query: string): boolean {
  if (!query) return false;
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return false;

  // Direct slash commands or single-word keywords
  if (trimmed === '/overview' || trimmed === 'overview') {
    return true;
  }

  // Common direct overview inquiries even without an explicit scope noun
  if (
    /^(what\s+does\s+this\s+do|how\s+does\s+this\s+work|tell\s+me\s+about\s+this|explain\s+everything|give\s+me\s+an\s+overview)\??$/i.test(
      trimmed
    )
  ) {
    return true;
  }

  // Repository / project scope nouns
  const hasScopeNoun =
    /\b(code\s*base|codebase|repo|repository|project|software|system|app|application|package|library)\b/i.test(
      trimmed
    );

  if (!hasScopeNoun) {
    return false;
  }

  // Intent verbs or inquiry keywords describing architectural analysis
  const hasIntentVerb =
    /\b(about|overview|summary|summarize|explain|describe|architecture|structure|purpose|tldr|intro|introduction|walkthrough)\b/i.test(
      trimmed
    );

  // Common question stems directed at the repository
  const hasQuestionPattern =
    /\b(what\s+is|what\s+does|how\s+does|what\s+are|tell\s+me|show\s+me)\b/i.test(
      trimmed
    );

  return hasIntentVerb || hasQuestionPattern;
}
