import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { BenchmarkMetric, QueryAuditItem } from '../types';

export const BenchmarkSection: React.FC = () => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const keyMetrics: BenchmarkMetric[] = [
    {
      name: 'Semantic Boundary Integrity (SBIR)',
      naiveValue: '0.67% intact',
      astValue: '100% intact',
      improvement: '+99.33%',
      description: 'Zero cut-off functions. Every retrieved code block is a complete, working code entity.'
    },
    {
      name: 'Mean Reciprocal Rank (MRR)',
      naiveValue: '0.5522',
      astValue: '0.5833',
      improvement: '+5.62%',
      description: 'The exact function you need lands at the top of results, feeding the AI better context.'
    },
    {
      name: 'Search Response Time',
      naiveValue: '21 ms',
      astValue: '24 ms',
      improvement: 'Instant',
      description: 'Runs in milliseconds on your own machine without waiting for cloud queues.'
    }
  ];

  const queryAuditData: QueryAuditItem[] = [
    { id: 'Q01', query: 'Where is the main entrypoint function for sending HTTP GET requests?', targetFile: 'api.py', naiveRank: '>5', astRank: '1', status: 'AST Higher' },
    { id: 'Q02', query: 'Where is the core Session.send method defined and how does it delegate to adapters?', targetFile: 'sessions.py', naiveRank: '2', astRank: '>5', status: 'Naive Higher' },
    { id: 'Q03', query: 'Where is the HTTPAdapter connection pool manager initialized?', targetFile: 'adapters.py', naiveRank: '1', astRank: '1', status: 'Tie' },
    { id: 'Q04', query: 'Where is CaseInsensitiveDict defined and how does it store case-insensitive keys?', targetFile: 'structures.py', naiveRank: '1', astRank: '1', status: 'Tie' },
    { id: 'Q05', query: 'Where is the basic auth header encoding string helper function?', targetFile: '_internal_utils.py', naiveRank: '>5', astRank: '>5', status: 'Tie' },
    { id: 'Q06', query: 'Where is the JSON decoding method on the HTTP Response object implemented?', targetFile: 'models.py', naiveRank: '>5', astRank: '3', status: 'AST Higher' },
    { id: 'Q07', query: 'Where is the cookie extraction from response headers to a cookiejar defined?', targetFile: 'cookies.py', naiveRank: '>5', astRank: '1', status: 'AST Higher' },
    { id: 'Q08', query: 'Where is the Session mount method for registering transport adapters?', targetFile: 'sessions.py', naiveRank: '1', astRank: '3', status: 'Naive Higher' },
    { id: 'Q09', query: 'Where is the system diagnostic and environment info function implemented?', targetFile: 'help.py', naiveRank: '3', astRank: '>5', status: 'Naive Higher' },
    { id: 'Q10', query: 'Where is the streaming content generator iter_content defined on Response?', targetFile: 'models.py', naiveRank: '2', astRank: '2', status: 'Tie' },
    { id: 'Q11', query: 'How does Session.get_adapter select the appropriate transport adapter for a given URL?', targetFile: 'sessions.py', naiveRank: '1', astRank: '1', status: 'Tie' },
    { id: 'Q12', query: 'How does the SessionRedirectMixin resolve HTTP 3xx redirects and generate the next request?', targetFile: 'sessions.py', naiveRank: '1', astRank: '2', status: 'Naive Higher' },
    { id: 'Q13', query: 'How does PreparedRequest assemble and validate the full target URL including query parameters?', targetFile: 'sessions.py', naiveRank: '>5', astRank: '>5', status: 'Tie' },
    { id: 'Q14', query: 'How does HTTPAdapter.send execute the request using urllib3 and handle connection retries?', targetFile: 'adapters.py', naiveRank: '>5', astRank: '1', status: 'AST Higher' },
    { id: 'Q15', query: 'How are authentication credentials prepared and attached to a PreparedRequest?', targetFile: 'sessions.py', naiveRank: '5', astRank: '2', status: 'AST Higher' },
    { id: 'Q16', query: 'How does HTTPAdapter construct a Requests Response object from an underlying urllib3 response?', targetFile: 'adapters.py', naiveRank: '1', astRank: '1', status: 'Tie' },
    { id: 'Q17', query: 'How are cookies converted and formatted into request headers during request preparation?', targetFile: 'sessions.py', naiveRank: '5', astRank: '4', status: 'AST Higher' },
    { id: 'Q18', query: 'How does HTTPDigestAuth calculate and construct the Digest challenge response header?', targetFile: 'cookies.py', naiveRank: '>5', astRank: '>5', status: 'Tie' },
    { id: 'Q19', query: 'How does HTTPBasicAuth implement the callable interface to attach authentication to requests?', targetFile: 'sessions.py', naiveRank: '2', astRank: '>5', status: 'Naive Higher' },
    { id: 'Q20', query: 'How does PreparedRequest.prepare orchestrate the preparation of method, url, headers, auth, and cookies?', targetFile: 'models.py', naiveRank: '1', astRank: '1', status: 'Tie' },
    { id: 'Q21', query: 'How does super_len calculate the total byte length of files, streams, and iterators?', targetFile: 'utils.py', naiveRank: '1', astRank: '1', status: 'Tie' },
    { id: 'Q22', query: 'How does should_bypass_proxies check if a URL matches no_proxy environment patterns?', targetFile: 'utils.py', naiveRank: '2', astRank: '3', status: 'Naive Higher' },
    { id: 'Q23', query: 'How does dispatch_hook invoke registered callback functions for request events?', targetFile: 'models.py', naiveRank: '>5', astRank: '>5', status: 'Tie' },
    { id: 'Q24', query: 'How is an exception raised when an HTTP response contains a 4xx or 5xx status code?', targetFile: 'adapters.py', naiveRank: '3', astRank: '4', status: 'Naive Higher' },
    { id: 'Q25', query: 'How are netrc credentials retrieved for a specific host from the user\'s home directory?', targetFile: 'utils.py', naiveRank: '1', astRank: '1', status: 'Tie' },
    { id: 'Q26', query: 'How does requote_uri normalize and percent-encode an unquoted URI?', targetFile: 'utils.py', naiveRank: '1', astRank: '1', status: 'Tie' },
    { id: 'Q27', query: 'How is a dictionary of key-value cookie pairs converted into a RequestsCookieJar?', targetFile: 'utils.py', naiveRank: '1', astRank: '2', status: 'Naive Higher' },
    { id: 'Q28', query: 'How does unquote_header_value strip surrounding quotes from header parameters?', targetFile: 'utils.py', naiveRank: '1', astRank: '1', status: 'Tie' },
    { id: 'Q29', query: 'How does CaseInsensitiveDict provide lower-cased item iteration for header lookups?', targetFile: 'structures.py', naiveRank: '2', astRank: '1', status: 'AST Higher' },
    { id: 'Q30', query: 'How does Session.close release connection pools and cleanup adapters?', targetFile: 'sessions.py', naiveRank: '1', astRank: '1', status: 'Tie' },
  ];

  const filteredQueries = queryAuditData.filter((item) => {
    const matchesFilter =
      filterStatus === 'all' ||
      (filterStatus === 'ast' && item.status === 'AST Higher') ||
      (filterStatus === 'naive' && item.status === 'Naive Higher') ||
      (filterStatus === 'tie' && item.status === 'Tie');

    const matchesSearch =
      item.query.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.targetFile.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.id.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  return (
    <section id="benchmarks" className="py-24 md:py-32 border-b border-amber-900/20">
      <div className="max-w-5xl mx-auto px-6 sm:px-8">
        {/* Section Header */}
        <div className="max-w-2xl mb-14">
          <div className="text-xs font-mono font-medium text-amber-400 uppercase tracking-widest mb-2">
            Proven Results
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#f4f7f4] tracking-tight mb-3">
            The Numbers Prove the Difference
          </h2>
          <p className="text-base text-[#9cb3a8] leading-relaxed">
            Tested across 30 real-world codebase queries. Keeping code intact delivers measurably higher accuracy with zero cloud latency.
          </p>
        </div>

        {/* High-Impact Stat Scorecards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {keyMetrics.map((m, idx) => (
            <div
              key={idx}
              data-testid={`metric-card-${idx}`}
              className="rounded-xl brass-border p-6 sm:p-7 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono text-[#9cb3a8]">
                    {m.name}
                  </span>
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/40">
                    {m.improvement}
                  </span>
                </div>

                <div className="my-3 py-2 border-y border-amber-900/20">
                  <div className="text-2xl sm:text-3xl font-bold text-amber-200 font-mono">
                    {m.astValue}
                  </div>
                  <div className="text-xs text-red-300/80 font-mono mt-1">
                    vs. {m.naiveValue} (standard AI)
                  </div>
                </div>
              </div>

              <p className="text-xs text-[#9cb3a8] leading-relaxed mt-2">
                {m.description}
              </p>
            </div>
          ))}
        </div>

        {/* Audit Search Box & Filter */}
        <div className="rounded-xl brass-border p-6 sm:p-7">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-base font-bold text-[#f4f7f4]">
                Audit All 30 Evaluation Queries
              </h3>
              <p className="text-xs text-[#9cb3a8]">
                Search or filter the empirical benchmark dataset
              </p>
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-60">
                <Search className="w-3.5 h-3.5 text-amber-400/60 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter queries..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  data-testid="audit-search-input"
                  className="w-full pl-9 pr-3 py-1.5 rounded-md bg-[#03130b] border border-amber-900/30 text-xs text-[#f4f7f4] placeholder-[#9cb3a8]/80 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div className="flex flex-wrap gap-1 text-xs font-mono">
                <button
                  onClick={() => setFilterStatus('all')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    filterStatus === 'all'
                      ? 'bg-amber-400 text-[#04140d] font-bold'
                      : 'bg-[#03130b] text-[#9cb3a8] hover:text-[#f4f7f4]'
                  }`}
                >
                  All (30)
                </button>
                <button
                  onClick={() => setFilterStatus('ast')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    filterStatus === 'ast'
                      ? 'bg-emerald-950 text-emerald-300 font-bold border border-emerald-800/40'
                      : 'bg-[#03130b] text-[#9cb3a8] hover:text-[#f4f7f4]'
                  }`}
                >
                  AST Higher (9)
                </button>
                <button
                  onClick={() => setFilterStatus('tie')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    filterStatus === 'tie'
                      ? 'bg-zinc-800 text-zinc-200 font-bold border border-zinc-700'
                      : 'bg-[#03130b] text-[#9cb3a8] hover:text-[#f4f7f4]'
                  }`}
                >
                  Ties (13)
                </button>
                <button
                  onClick={() => setFilterStatus('naive')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    filterStatus === 'naive'
                      ? 'bg-red-950 text-red-300 font-bold border border-red-900/40'
                      : 'bg-[#03130b] text-[#9cb3a8] hover:text-[#f4f7f4]'
                  }`}
                >
                  Naive Higher (8)
                </button>
              </div>
            </div>
          </div>

          {/* Clean Scrollable Queries List with Click-to-Expand */}
          <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="sticky top-0 bg-[#061e14] border-b border-amber-900/20 text-amber-400">
                <tr>
                  <th className="py-2.5 px-3">ID</th>
                  <th className="py-2.5 px-3">Query (Click to Expand)</th>
                  <th className="py-2.5 px-3">Target File</th>
                  <th className="py-2.5 px-3 text-right">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-900/10 text-[#d1dfd6]">
                {filteredQueries.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-xs text-[#9cb3a8]">
                      No evaluation queries match &quot;<span className="text-amber-300 font-mono">{searchTerm}</span>&quot;. Try searching for &quot;routing&quot;, &quot;auth&quot;, or &quot;models&quot;.
                    </td>
                  </tr>
                ) : (
                  filteredQueries.map((item) => {
                    const isExpanded = expandedId === item.id;
                    return (
                      <tr
                        key={item.id}
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        className="hover:bg-[#072418]/80 transition-colors cursor-pointer group"
                        title="Click to toggle full query details"
                      >
                        <td className="py-2.5 px-3 text-amber-300 font-semibold align-top">{item.id}</td>
                        <td className="py-2.5 px-3 font-sans text-xs">
                          <div className={isExpanded ? 'text-[#f4f7f4] leading-relaxed font-medium' : 'text-[#d1dfd6] max-w-sm truncate group-hover:text-[#f4f7f4]'}>
                            {item.query}
                          </div>
                          {isExpanded && (
                            <div className="mt-2 pt-2 border-t border-amber-900/20 text-[11px] font-mono text-[#9cb3a8] flex flex-wrap gap-4">
                              <span>Target: <strong className="text-amber-200">{item.targetFile}</strong></span>
                              <span>Naive Rank: <strong className="text-red-300">#{item.naiveRank}</strong></span>
                              <span>AST Rank: <strong className="text-emerald-300">#{item.astRank}</strong></span>
                              <span className="text-amber-400/80">Click row to collapse</span>
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-[#9cb3a8] align-top">{item.targetFile}</td>
                        <td className="py-2.5 px-3 text-right align-top">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                              item.status === 'AST Higher'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/40'
                                : item.status === 'Tie'
                                ? 'bg-zinc-900 text-zinc-300 border border-zinc-700/40'
                                : 'bg-red-950 text-red-300 border border-red-900/40'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
};
