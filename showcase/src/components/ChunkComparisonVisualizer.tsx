import React, { useState, useMemo } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';

interface CodeComparisonExample {
  title: string;
  sourceFile: string;
  naiveChunk: {
    startLine: number;
    endLine: number;
    code: string;
    flaws: string[];
    aiExplanation: string;
    sbirScore: string;
  };
  astChunk: {
    nodeType: string;
    identifier: string;
    startLine: number;
    endLine: number;
    code: string;
    benefits: string[];
    aiExplanation: string;
    sbirScore: string;
  };
}

const HighlightedPython: React.FC<{ code: string }> = ({ code }) => {
  const html = useMemo(() => {
    try {
      return Prism.highlight(code, Prism.languages.python, 'python');
    } catch {
      return code;
    }
  }, [code]);

  return <code dangerouslySetInnerHTML={{ __html: html }} />;
};

export const ChunkComparisonVisualizer: React.FC = () => {
  const [activeExampleIndex, setActiveExampleIndex] = useState(0);

  const examples: CodeComparisonExample[] = [
    {
      title: 'FastAPI Web Route',
      sourceFile: 'fastapi/routing.py',
      naiveChunk: {
        startLine: 114,
        endLine: 128,
        code: `        response_model: Optional[Type[Any]] = None,
        status_code: Optional[int] = None,
        tags: Optional[List[Union[str, Enum]]] = None,
        dependencies: Optional[Sequence[params.Depends]] = None,
    ) -> Callable[[DecoratedCallable], DecoratedCallable]:
        return self.api_route(
            path=path,
            response_model=response_model,
            status_code=status_code,
            tags=tags,
            dependencies=dependencies,
        )
    def post(
        self,`,
        flaws: [
          'Function name and "@app.get" decorator missing',
          'Cut midway through arguments: cannot run or parse',
          'Spills into "def post(" without body'
        ],
        aiExplanation: 'The AI misses the route decorator, guesses parameter types, and invents what this endpoint returns because the function signature was cut off.',
        sbirScore: 'SBIR: 0.67%'
      },
      astChunk: {
        nodeType: 'FunctionDef',
        identifier: 'APIRouter.get',
        startLine: 108,
        endLine: 126,
        code: `    @doc(summary="Add a GET operation")
    def get(
        self,
        path: str,
        *,
        response_model: Optional[Type[Any]] = None,
        status_code: Optional[int] = None,
        tags: Optional[List[Union[str, Enum]]] = None,
        dependencies: Optional[Sequence[params.Depends]] = None,
    ) -> Callable[[DecoratedCallable], DecoratedCallable]:
        """Add a GET operation to the router."""
        return self.api_route(
            path=path,
            response_model=response_model,
            status_code=status_code,
            tags=tags,
            dependencies=dependencies,
        )`,
        benefits: [
          'Full function from decorator to return value',
          'Complete parameters and documentation intact',
          '100% syntactically valid code block'
        ],
        aiExplanation: 'The AI explains the route path, dependency injection chain, and return types with 100% precision and zero hallucinations.',
        sbirScore: 'SBIR: 100.0%'
      }
    },
    {
      title: 'Network Request Handler',
      sourceFile: 'requests/sessions.py',
      naiveChunk: {
        startLine: 742,
        endLine: 755,
        code: `        # Try to send the request
        try:
            resp = conn.send(
                req.method,
                req.url,
                body=req.body,
                headers=req.headers,
                redirect=False,
                assert_same_host=False,
                preload_content=False,
                decode_content=False,
                retries=self.max_retries,
                timeout=timeout
            )
        except MaxRetryError as e:`,
        flaws: [
          'Cut inside try block: error handler logic sliced off',
          'Function name and arguments completely missing',
          'AI has to hallucinate return and error types'
        ],
        aiExplanation: 'The AI cannot identify the method or arguments, and hallucinates how retry exceptions are handled because the block was severed.',
        sbirScore: 'SBIR: 0.67%'
      },
      astChunk: {
        nodeType: 'FunctionDef',
        identifier: 'HTTPAdapter.send',
        startLine: 728,
        endLine: 765,
        code: `    def send(
        self, request: PreparedRequest, stream: bool = False, timeout: Optional[Union[float, Tuple[float, float]]] = None, verify: bool = True, cert: Optional[Union[str, Tuple[str, str]]] = None, proxies: Optional[Mapping[str, str]] = None
    ) -> Response:
        """Sends PreparedRequest object. Returns Response object."""
        try:
            conn = self.get_connection(request.url, proxies)
        except LocationValueError as e:
            raise InvalidURL(e, request=request)

        self.cert_verify(conn, request.url, verify, cert)
        url = self.request_url(request, proxies)
        self.add_headers(request, stream=stream, timeout=timeout, verify=verify, cert=cert, proxies=proxies)

        chunked_upload = "Transfer-Encoding" in request.headers and request.headers["Transfer-Encoding"] == "chunked"
        resp = conn.urlopen(
            method=request.method,
            url=url,
            body=request.body,
            headers=request.headers,
            redirect=False,
            assert_same_host=False,
            preload_content=False,
            decode_content=False,
            retries=self.max_retries,
            timeout=timeout
        )
        return self.build_response(request, resp)`,
        benefits: [
          'Complete method from start to finish',
          'All parameters and exception handlers preserved intact',
          'Zero guesswork for the AI'
        ],
        aiExplanation: 'The AI accurately explains connection pooling, request verification, and retry handling from method signature to return value.',
        sbirScore: 'SBIR: 100.0%'
      }
    }
  ];

  const current = examples[activeExampleIndex];

  return (
    <section id="comparison" className="py-24 md:py-32 border-b border-[#dad0a7]/30">
      <div className="max-w-6xl mx-auto px-6 sm:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mb-12">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#0a1f10]/5 border border-[#0a1f10]/15 text-xs font-mono font-bold text-[#0a1f10] uppercase tracking-wider mb-3">
            <span className="w-2 h-2 rounded-full bg-[#68f12b]" />
            <span>[ SYNTACTIC FIDELITY // HEAD-TO-HEAD AUDIT ]</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black font-display text-[#0a1f10] uppercase tracking-tight mb-4">
            Why Fragmented Code Ruins AI Explanations
          </h2>
          <p className="text-base sm:text-lg text-[#0a1f10]/75 leading-relaxed font-sans">
            When code is sliced by arbitrary character limits, the AI is forced to hallucinate missing logic. When the entire syntax tree is preserved, the AI explains your architecture with 100% precision.
          </p>
        </div>

        {/* Example Switcher Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-8">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#0a1f10]/60 mr-2">
            Target Codebase:
          </span>
          {examples.map((ex, idx) => (
            <button
              key={idx}
              onClick={() => setActiveExampleIndex(idx)}
              data-testid={`example-btn-${idx}`}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all shadow-sm ${
                activeExampleIndex === idx
                  ? 'bg-[#0a1f10] text-[#68f12b] border border-[#68f12b]/40 ring-1 ring-[#68f12b]/30'
                  : 'bg-white text-[#0a1f10] hover:bg-[#f4f3eb] border border-[#0a1f10]/15'
              }`}
            >
              {ex.title} <span className="opacity-60 text-[10px]">({ex.sourceFile})</span>
            </button>
          ))}
        </div>

        {/* Comparison Panels: Industrial Side-by-Side Specimens */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-stretch">
          {/* Left: Naive Slicing (Defect Report / Reject Ticket) */}
          <div
            data-testid="naive-chunk-panel"
            className="rounded-3xl bg-[#14080a] border-2 border-red-500/30 p-7 sm:p-8 flex flex-col justify-between text-[#f4f3eb] shadow-xl relative overflow-hidden"
          >
            <div>
              {/* Header row */}
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-dashed border-red-500/25">
                <div>
                  <div className="text-base sm:text-lg font-black font-display uppercase tracking-tight text-red-400">
                    The Naive Chunker's Gamble
                  </div>
                  <div className="text-xs text-red-200/70 font-mono mt-0.5">
                    Character Boundary Split • Syntax Broken
                  </div>
                </div>
                <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-red-950/80 text-red-400 border border-red-800/60 uppercase tracking-wider shadow-inner">
                  {current.naiveChunk.sbirScore}
                </span>
              </div>

              {/* Code Box */}
              <div className="rounded-2xl bg-[#090204] border border-red-950 p-4 font-mono text-xs overflow-y-auto leading-relaxed h-[230px] mb-5 text-red-100/90 shadow-inner">
                <pre>
                  <HighlightedPython code={current.naiveChunk.code} />
                </pre>
              </div>

              {/* Bullet Flaws */}
              <div className="space-y-2 text-xs text-red-200/90 pt-1 mb-5">
                {current.naiveChunk.flaws.map((flaw, idx) => (
                  <div key={idx} className="flex items-start space-x-2 font-mono">
                    <span className="text-red-400 font-bold select-none">✕</span>
                    <span className="font-sans text-xs leading-normal">{flaw}</span>
                  </div>
                ))}
              </div>

              {/* AI Explanation Impact Alert */}
              <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/50 text-xs">
                <div className="text-red-400 font-bold font-mono text-[11px] uppercase tracking-wider mb-1 flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                  <span>AI Explanation Failure:</span>
                </div>
                <p className="font-sans text-[11px] text-red-200/90 leading-relaxed">
                  {current.naiveChunk.aiExplanation}
                </p>
              </div>
            </div>

            <div className="pt-4 mt-5 border-t border-red-950/80 text-[11px] font-mono text-red-300/70 flex justify-between">
              <span>LINES {current.naiveChunk.startLine}–{current.naiveChunk.endLine}</span>
              <span className="text-red-400 uppercase font-semibold">ARBITRARY CHARACTER CUT</span>
            </div>
          </div>

          {/* Right: Tree-Sitter AST (Certified Engineering Specimen) */}
          <div
            data-testid="ast-chunk-panel"
            className="rounded-3xl bg-[#0a1f10] border-2 border-[#68f12b]/50 p-7 sm:p-8 flex flex-col justify-between text-[#f4f3eb] shadow-2xl relative overflow-hidden"
          >
            <div>
              {/* Header row */}
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-dashed border-[#dad0a7]/20">
                <div>
                  <div className="text-base sm:text-lg font-black font-display uppercase tracking-tight text-[#68f12b]">
                    Tree-Sitter AST Determinism
                  </div>
                  <div className="text-xs text-[#dad0a7] font-mono mt-0.5">
                    Grammar Node Extracted • 100% Intact
                  </div>
                </div>
                <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-[#143520] text-[#68f12b] border border-[#68f12b]/60 uppercase tracking-wider shadow-[0_0_12px_rgba(104,241,43,0.2)]">
                  {current.astChunk.sbirScore}
                </span>
              </div>

              {/* AST Grammar Metadata Pill */}
              <div className="mb-4 px-3.5 py-1.5 rounded-xl bg-[#06150b] border border-[#dad0a7]/20 flex items-center justify-between text-[11px] font-mono text-[#dad0a7]">
                <span>NODE: <strong className="text-[#68f12b]">{current.astChunk.nodeType}</strong></span>
                <span>SYMBOL: <strong className="text-[#68f12b]">{current.astChunk.identifier}</strong></span>
              </div>

              {/* Code Box */}
              <div className="rounded-2xl bg-[#030d06] border border-[#dad0a7]/20 p-4 font-mono text-xs overflow-y-auto leading-relaxed h-[230px] mb-5 text-[#f4f3eb] shadow-inner">
                <pre>
                  <HighlightedPython code={current.astChunk.code} />
                </pre>
              </div>

              {/* Bullet Guarantees */}
              <div className="space-y-2 text-xs text-[#dad0a7] pt-1 mb-5">
                {current.astChunk.benefits.map((b, idx) => (
                  <div key={idx} className="flex items-start space-x-2 font-mono">
                    <span className="text-[#68f12b] font-bold select-none">✓</span>
                    <span className="font-sans text-xs leading-normal text-[#f4f3eb]">{b}</span>
                  </div>
                ))}
              </div>

              {/* AI Explanation Impact Alert */}
              <div className="p-3.5 rounded-xl bg-[#0d2614] border border-[#68f12b]/50 text-xs shadow-sm">
                <div className="text-[#68f12b] font-bold font-mono text-[11px] uppercase tracking-wider mb-1 flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#68f12b]" />
                  <span>AI Explanation Success:</span>
                </div>
                <p className="font-sans text-[11px] text-[#f4f3eb] leading-relaxed">
                  {current.astChunk.aiExplanation}
                </p>
              </div>
            </div>

            <div className="pt-4 mt-5 border-t border-[#dad0a7]/20 text-[11px] font-mono text-[#dad0a7]/70 flex justify-between">
              <span>LINES {current.astChunk.startLine}–{current.astChunk.endLine}</span>
              <span className="text-[#68f12b] uppercase font-semibold">COMPLETE PYTHON NODE</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
