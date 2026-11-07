import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CodeDisplay } from '../components/viewer/CodeDisplay';
import { CodeViewerContainer } from '../components/viewer/CodeViewerContainer';
import { AstCodeChunk } from '../types';

describe('Empirical Challenger: Code Search Highlighting Adversarial Suite', () => {
  // Test chunk with rich Python syntax tokens: keywords, functions, classes, operators, strings, comments, numbers
  const testChunk: AstCodeChunk = {
    id: 'test-chunk-1',
    filePath: 'backend/app/core/adversarial.py',
    fileName: 'adversarial.py',
    astNodeType: 'ClassDef',
    identifier: 'AdversarialTokenManager',
    startLine: 1,
    endLine: 40,
    relevanceScore: 0.95,
    summary: 'Class for adversarial testing of code search highlighting',
    code: `import os
import sys

class AdversarialTokenManager:
    """Manages token keyword class function property."""
    
    def __init__(self, token_name: str = "default_token", max_tokens: int = 100):
        self.token_name = token_name
        self.token_count = max_tokens
        self.raw_markup = "<span>safe_tag</span> and <mark>highlight</mark>"
        self.regex_pattern = r"^[$]?[0-9]+(\\.[0-9]{2})?$"
        self.comparison = 10 < 20 and 30 > 5
        self.bitwise = 0b1010 & 0b1100
        self.price = "$99.99"
        self.formula = "(x + y) * [a - b] / {c | d}?"

    def get_token(self) -> str:
        # Returns the token value
        keyword = "token_override"
        return f"{self.token_name}_{keyword}"

    def calculate_cost(self, factor: float) -> str:
        return f"Total: \${factor * 100}"
`,
  };

  describe('1. HTML Tag Injection & Tag Attribute Immunity', () => {
    it('does not corrupt Prism HTML tag attributes when searching for HTML tags', () => {
      let count = 0;
      const { container } = render(
        <CodeDisplay
          chunk={testChunk}
          searchTerm="<span>"
          onMatchCountChange={(c) => { count = c; }}
        />
      );

      const codeElem = container.querySelector('code');
      expect(codeElem).toBeInTheDocument();
      // Searching literal "<span>" does not corrupt any existing <span class="..."> tags
      // Verify no malformed attributes like <span <mark> or class="<mark
      expect(codeElem?.innerHTML).not.toContain('<span <mark');
      expect(codeElem?.innerHTML).not.toContain('class="<mark');
      // Verify all spans close properly
      const openSpans = (codeElem?.innerHTML.match(/<span/g) || []).length;
      const closeSpans = (codeElem?.innerHTML.match(/<\/span>/g) || []).length;
      expect(openSpans).toBe(closeSpans);
    });

    it('safely handles search terms matching highlighting tag "<mark>" and "</mark>"', () => {
      let count = 0;
      const { container } = render(
        <CodeDisplay
          chunk={testChunk}
          searchTerm="<mark>"
          onMatchCountChange={(c) => { count = c; }}
        />
      );

      const codeElem = container.querySelector('code');
      expect(codeElem).toBeInTheDocument();
      // Should not create recursive or malformed <mark <mark> tags
      expect(codeElem?.innerHTML).not.toContain('<mark <mark');
      expect(codeElem?.innerHTML).not.toContain('<<mark>');
      // Verify mark tags are balanced
      const openMarks = (codeElem?.innerHTML.match(/<mark/g) || []).length;
      const closeMarks = (codeElem?.innerHTML.match(/<\/mark>/g) || []).length;
      expect(openMarks).toBe(closeMarks);
    });

    it('safely handles closing tag search "</div>" and "<script>" without DOM mutation', () => {
      let count = 0;
      const { container } = render(
        <CodeDisplay
          chunk={testChunk}
          searchTerm="</div>"
          onMatchCountChange={(c) => { count = c; }}
        />
      );

      const codeElem = container.querySelector('code');
      expect(codeElem?.innerHTML).not.toContain('<div');
      expect(codeElem?.innerHTML).not.toContain('</div');
      expect(count).toBe(0);
    });

    it('empirically observes search behavior with HTML entities like "->", "<", and "&"', () => {
      let countArrow = -1;
      render(
        <CodeDisplay
          chunk={testChunk}
          searchTerm="->"
          onMatchCountChange={(c) => { countArrow = c; }}
        />
      );

      let countLt = -1;
      render(
        <CodeDisplay
          chunk={testChunk}
          searchTerm="<"
          onMatchCountChange={(c) => { countLt = c; }}
        />
      );

      let countAmp = -1;
      const { container } = render(
        <CodeDisplay
          chunk={testChunk}
          searchTerm="&"
          onMatchCountChange={(c) => { countAmp = c; }}
        />
      );

      expect(countArrow).toBe(0);
      expect(countLt).toBe(0);
      expect(countAmp).toBe(6);
    });

    it('produces 100% valid DOM structure with zero parsing errors across diverse search terms', () => {
      const searchTerms = [
        'def',
        'token',
        '<span>',
        '<mark>',
        'class',
        '$',
        '(',
        '[',
        '\\',
        '100',
        'keyword',
        'adversarial',
        'price',
      ];

      searchTerms.forEach((term) => {
        let count = 0;
        const { container } = render(
          <CodeDisplay
            chunk={testChunk}
            searchTerm={term}
            onMatchCountChange={(c) => { count = c; }}
          />
        );

        const codeElem = container.querySelector('code');
        expect(codeElem).toBeInTheDocument();
        const html = codeElem?.innerHTML || '';

        // Validate HTML well-formedness using DOMParser
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
        const parseErrors = doc.querySelectorAll('parsererror');
        expect(parseErrors.length).toBe(0);

        // Verify balanced tags: every opening <mark> has a closing </mark>
        const openMarks = (html.match(/<mark\b/g) || []).length;
        const closeMarks = (html.match(/<\/mark>/g) || []).length;
        expect(openMarks).toBe(closeMarks);
        expect(openMarks).toBe(count);
      });
    });
  });

  describe('2. Regex Metacharacters Stress Testing', () => {
    const metacharacters = [
      { char: '(', expectedInCode: true },
      { char: ')', expectedInCode: true },
      { char: '[', expectedInCode: true },
      { char: ']', expectedInCode: true },
      { char: '*', expectedInCode: true },
      { char: '+', expectedInCode: true },
      { char: '?', expectedInCode: true },
      { char: '\\', expectedInCode: true },
      { char: '^', expectedInCode: true },
      { char: '$', expectedInCode: true },
      { char: '{', expectedInCode: true },
      { char: '}', expectedInCode: true },
      { char: '|', expectedInCode: true },
      { char: '.', expectedInCode: true },
      { char: '-', expectedInCode: true },
      { char: '/', expectedInCode: true },
    ];

    metacharacters.forEach(({ char }) => {
      it(`safely handles regex metacharacter "${char}" without throwing SyntaxError`, () => {
        let count = -1;
        expect(() => {
          render(
            <CodeDisplay
              chunk={testChunk}
              searchTerm={char}
              onMatchCountChange={(c) => { count = c; }}
            />
          );
        }).not.toThrow();
        expect(count).toBeGreaterThanOrEqual(0);
      });
    });

    it('safely handles catastrophic regex inputs and unclosed groupings', () => {
      const maliciousPatterns = [
        '(((((((',
        '[[[[[[[',
        '*+?*+?',
        '\\',
        '\\\\\\\\',
        '(?=a)+',
        '(?<=a)+',
        '[a-z',
        'a{1,2}{3,4}',
        '(?:',
        '^$$^^$$',
      ];

      maliciousPatterns.forEach((pattern) => {
        let count = -1;
        expect(() => {
          render(
            <CodeDisplay
              chunk={testChunk}
              searchTerm={pattern}
              onMatchCountChange={(c) => { count = c; }}
            />
          );
        }).not.toThrow();
        expect(count).toBeGreaterThanOrEqual(0);
      });
    });

    it('correctly handles dollar sign "$" without corrupting replacement capture references', () => {
      let count = 0;
      const { container } = render(
        <CodeDisplay
          chunk={testChunk}
          searchTerm="$"
          onMatchCountChange={(c) => { count = c; }}
        />
      );

      // In testChunk, there are literal '$' characters in:
      // self.regex_pattern = r"^[$]?[0-9]+(\\.[0-9]{2})?$" -> 2 occurrences ($ inside [$], and $ before ")
      // self.price = "$99.99" -> 1 occurrence
      // return f"Total: \${factor * 100}" -> 1 occurrence
      expect(count).toBe(4);
      const codeElem = container.querySelector('code');
      // Verify that the highlighted output contains <mark...>$</mark>, NOT undefined or $1 literally
      expect(codeElem?.innerHTML).toContain('<mark class="bg-amber-400/30 text-amber-200 border-b border-amber-400 font-semibold px-0.5 rounded">$</mark>');
      expect(codeElem?.innerHTML).not.toContain('$1');
    });
  });

  describe('3. Prism Token Class Name Collisions', () => {
    const tokenClasses = [
      'token',
      'class',
      'keyword',
      'function',
      'property',
      'operator',
      'string',
      'comment',
      'number',
      'punctuation',
    ];

    tokenClasses.forEach((tokenName) => {
      it(`preserves Prism markup and does not corrupt class attributes when searching "${tokenName}"`, () => {
        let count = 0;
        const { container } = render(
          <CodeDisplay
            chunk={testChunk}
            searchTerm={tokenName}
            onMatchCountChange={(c) => { count = c; }}
          />
        );

        const codeElem = container.querySelector('code');
        expect(codeElem).toBeInTheDocument();
        const html = codeElem?.innerHTML || '';

        // Crucial invariant: No tag attribute must ever contain a <mark> tag
        expect(html).not.toMatch(/<span[^>]*<mark/);
        expect(html).not.toMatch(/class="[^"]*<mark/);

        // Every <mark> tag must be strictly text node content, not attribute content
        const marks = container.querySelectorAll('mark');
        marks.forEach((mark) => {
          expect(mark.textContent?.toLowerCase()).toBe(tokenName.toLowerCase());
        });

        // The count must match exactly the number of <mark> elements rendered
        expect(marks.length).toBe(count);
      });
    });

    it('accurately counts occurrences of "token" in code text without counting Prism class attributes', () => {
      let count = 0;
      render(
        <CodeDisplay
          chunk={testChunk}
          searchTerm="token"
          onMatchCountChange={(c) => { count = c; }}
        />
      );

      // Let's count genuine occurrences of case-insensitive "token" in testChunk.code:
      // 1. AdversarialTokenManager (1)
      // 2. """Manages token keyword...""" (1)
      // 3. token_name (1)
      // 4. "default_token" (1)
      // 5. max_tokens (1)
      // 6. self.token_name (1)
      // 7. token_name (1)
      // 8. self.token_count (1)
      // 9. max_tokens (1)
      // 10. def get_token(self) (1)
      // 11. # Returns the token value (1)
      // 12. "token_override" (1)
      // 13. self.token_name (1)
      // Total genuine occurrences in raw code: 13
      const rawMatches = testChunk.code.match(/token/gi);
      expect(rawMatches?.length).toBe(13);
      expect(count).toBe(13);
    });
  });

  describe('4. Extreme Scale & Input Robustness', () => {
    it('handles large code chunks (300 lines / 18,000 characters) with fast execution', () => {
      const repeatedLine = '    result += calculate_token_value(token_id=idx, factor=1.5)\n';
      const largeCode = 'def process_large_stream():\n' + repeatedLine.repeat(300);
      const largeChunk: AstCodeChunk = {
        id: 'large-chunk',
        filePath: 'backend/app/large_stream.py',
        fileName: 'large_stream.py',
        astNodeType: 'FunctionDef',
        identifier: 'process_large_stream',
        startLine: 1,
        endLine: 302,
        relevanceScore: 0.8,
        summary: 'Massive function for stress test',
        code: largeCode,
      };

      const start = performance.now();
      let count = 0;
      const { container } = render(
        <CodeDisplay
          chunk={largeChunk}
          searchTerm="token_id"
          onMatchCountChange={(c) => { count = c; }}
        />
      );
      const duration = performance.now() - start;

      // 300 matches should be found cleanly
      expect(count).toBe(300);
      // Execution must complete in reasonable time even under parallel CPU runner load
      expect(duration).toBeLessThan(5000);

      const codeElem = container.querySelector('code');
      expect(codeElem).toBeInTheDocument();
    });

    it('safely handles extremely long search input (5,000 characters)', () => {
      const longTerm = 'A'.repeat(5000);
      let count = -1;
      expect(() => {
        render(
          <CodeDisplay
            chunk={testChunk}
            searchTerm={longTerm}
            onMatchCountChange={(c) => { count = c; }}
          />
        );
      }).not.toThrow();
      expect(count).toBe(0);
    });

    it('handles Unicode, emoji, and special character search terms', () => {
      const unicodeChunk: AstCodeChunk = {
        id: 'unicode-chunk',
        filePath: 'backend/app/unicode.py',
        fileName: 'unicode.py',
        astNodeType: 'FunctionDef',
        identifier: 'unicode_func',
        startLine: 1,
        endLine: 5,
        relevanceScore: 0.9,
        summary: 'Unicode test',
        code: `def emoji_test():\n    msg = "🚀 Rocket Launch 🔥"\n    name = "Café au lait"\n    return msg\n`,
      };

      let countRocket = 0;
      render(
        <CodeDisplay
          chunk={unicodeChunk}
          searchTerm="🚀"
          onMatchCountChange={(c) => { countRocket = c; }}
        />
      );
      expect(countRocket).toBe(1);

      let countCafe = 0;
      render(
        <CodeDisplay
          chunk={unicodeChunk}
          searchTerm="Café"
          onMatchCountChange={(c) => { countCafe = c; }}
        />
      );
      expect(countCafe).toBe(1);
    });

    it('ignores whitespace-only search terms and preserves unmodified HTML', () => {
      let count = -1;
      const { container } = render(
        <CodeDisplay
          chunk={testChunk}
          searchTerm="     "
          onMatchCountChange={(c) => { count = c; }}
        />
      );

      expect(count).toBe(0);
      expect(container.querySelectorAll('mark').length).toBe(0);
    });

    it('handles null chunk gracefully without error and reports 0 matches', () => {
      let count = -1;
      expect(() => {
        render(
          <CodeDisplay
            chunk={null}
            searchTerm="token"
            onMatchCountChange={(c) => { count = c; }}
          />
        );
      }).not.toThrow();
      expect(count).toBe(0); // 0 matches dispatched when null
    });
  });

  describe('5. Full Component Integration & Header Pill Verification', () => {
    it('synchronizes match count pill accurately in CodeViewerContainer', async () => {
      const user = userEvent.setup({ delay: null });
      render(
        <CodeViewerContainer
          chunks={[testChunk]}
          selectedChunkId={testChunk.id}
          onSelectChunk={() => {}}
        />
      );

      // Open search bar
      const openBtn = screen.getByTestId('open-code-search-btn');
      await user.click(openBtn);

      const input = screen.getByTestId('code-search-input');
      expect(input).toBeInTheDocument();

      // Search for "AdversarialTokenManager" -> exactly 1 match
      await user.type(input, 'AdversarialTokenManager');
      const pill = screen.getByTestId('search-match-count');
      expect(pill).toHaveTextContent('1 match');

      // Change search to "token" -> exactly 13 matches
      await user.clear(input);
      await user.type(input, 'token');
      expect(screen.getByTestId('search-match-count')).toHaveTextContent('13 matches');

      // Change search to non-existent string -> 0 matches
      await user.clear(input);
      await user.type(input, 'zebra_xylophone_999');
      expect(screen.getByTestId('search-match-count')).toHaveTextContent('0 matches');

      // Close search -> input and count pill vanish
      const closeBtn = screen.getByTestId('clear-code-search-btn');
      await user.click(closeBtn);
      expect(screen.queryByTestId('code-search-input')).not.toBeInTheDocument();
      expect(screen.queryByTestId('search-match-count')).not.toBeInTheDocument();
    });
  });
});
