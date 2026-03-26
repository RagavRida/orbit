import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Eye, EyeOff, X, Plus, Clock, Bell, Volume2, Package, Link2, DollarSign, ArrowDown, RefreshCw } from "lucide-react";

interface WatchEntryDisplay {
  slug: string;
  domain: string;
  companyName: string;
  addedAt: number;
  lastChecked?: number;
  notifyCount: number;
  monitoredPages: string[];
  knowledgeSections: Record<string, boolean>;
  lastChange?: { timestamp: number; summary: string; url: string; changedSection?: string } | null;
}

interface AlertEntry {
  slug: string;
  company: string;
  timestamp: number;
  summary: string;
  changedUrl: string;
  acknowledged: boolean;
}

interface ProductEntry {
  id: string;
  url: string;
  name: string;
  alertConditions: {
    priceBelow?: number;
    priceDropPercent?: number;
    backInStock?: boolean;
    anyChange?: boolean;
  };
  currentData: {
    title: string;
    price: number | null;
    currency: string;
    originalPrice: number | null;
    availability: string;
    rating: number | null;
    reviewCount: number | null;
    features: string[];
    lastUpdated: number;
  } | null;
  addedAt: number;
  lastChecked: number;
  alertCount: number;
}

interface WatchListProps {
  entries: WatchEntryDisplay[];
  alerts: AlertEntry[];
  isWatchMode: boolean;
  onToggleWatchMode: () => void;
  onRemove: (slug: string) => void;
  onCheckNow: (slug: string) => void;
  onPlayAlert: (summary: string) => void;
  // Product tracking
  products?: ProductEntry[];
  onAddProduct?: (url: string, name: string, priceBelow?: number) => void;
  onRemoveProduct?: (id: string) => void;
  onCheckProduct?: (id: string) => void;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

const WatchList: React.FC<WatchListProps> = ({
  entries, alerts, isWatchMode, onToggleWatchMode, onRemove, onCheckNow, onPlayAlert,
  products = [], onAddProduct, onRemoveProduct, onCheckProduct,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"competitors" | "products">("competitors");
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [productUrl, setProductUrl] = useState("");
  const [productName, setProductName] = useState("");
  const [priceAlert, setPriceAlert] = useState("");
  const unreadCount = alerts.filter(a => !a.acknowledged).length;

  const handleAddProduct = () => {
    if (!productUrl || !productName) return;
    onAddProduct?.(productUrl, productName, priceAlert ? parseFloat(priceAlert) : undefined);
    setProductUrl("");
    setProductName("");
    setPriceAlert("");
    setShowAddProduct(false);
  };

  return (
    <>
      {/* Collapsed: badge icon */}
      <motion.button
        onClick={() => setIsExpanded(!isExpanded)}
        className="fixed top-20 right-4 z-50 w-10 h-10 rounded-full bg-black/70 backdrop-blur-xl border border-white/10 flex items-center justify-center shadow-lg hover:bg-white/10 transition-colors"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <Eye size={18} className="text-orange-400" />
        {(entries.length > 0 || products.length > 0 || unreadCount > 0) && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-orange-500 text-[10px] text-white font-bold flex items-center justify-center">
            {unreadCount > 0 ? unreadCount : entries.length + products.length}
          </span>
        )}
      </motion.button>

      {/* Expanded panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="fixed top-20 right-16 z-50 w-[320px] max-h-[75vh] overflow-y-auto"
          >
            <div className="bg-black/85 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
              {/* Header with tabs */}
              <div className="px-4 py-3 border-b border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Eye size={14} className="text-orange-400" />
                    Watch & Track
                  </h3>
                  <button onClick={() => setIsExpanded(false)} className="text-white/30 hover:text-white/60">
                    <X size={16} />
                  </button>
                </div>
                {/* Tab switcher */}
                <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
                  <button
                    onClick={() => setActiveTab("competitors")}
                    className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                      activeTab === "competitors" ? "bg-orange-500/20 text-orange-400" : "text-white/40 hover:text-white/60"
                    }`}
                  >
                    <Eye size={10} /> Competitors {entries.length > 0 && `(${entries.length})`}
                  </button>
                  <button
                    onClick={() => setActiveTab("products")}
                    className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                      activeTab === "products" ? "bg-purple-500/20 text-purple-400" : "text-white/40 hover:text-white/60"
                    }`}
                  >
                    <Package size={10} /> Products {products.length > 0 && `(${products.length})`}
                  </button>
                </div>
              </div>

              {/* ── COMPETITORS TAB ── */}
              {activeTab === "competitors" && (
                <>
                  <div className="p-3 space-y-2">
                    {entries.length === 0 ? (
                      <p className="text-xs text-white/30 text-center py-4">No competitors being watched</p>
                    ) : (
                      entries.map(entry => (
                        <div key={entry.slug} className="bg-white/5 rounded-xl p-3 border border-white/5 group">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">👁</span>
                              <span className="text-xs font-bold text-white">{entry.companyName}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => onCheckNow(entry.slug)}
                                className="px-1.5 py-0.5 rounded bg-orange-500/15 text-[9px] text-orange-400 font-mono hover:bg-orange-500/25 transition-colors"
                              >
                                CHECK
                              </button>
                              <button
                                onClick={() => onRemove(entry.slug)}
                                className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-all"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </div>

                          {entry.knowledgeSections && Object.keys(entry.knowledgeSections).length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-1.5">
                              {entry.knowledgeSections.homepage && <span className="px-1 py-0.5 rounded bg-emerald-500/15 text-[8px] text-emerald-400 font-mono" title="Homepage">🏠</span>}
                              {entry.knowledgeSections.aboutPage && <span className="px-1 py-0.5 rounded bg-blue-500/15 text-[8px] text-blue-400 font-mono" title="About page">📋</span>}
                              {entry.knowledgeSections.pricingPage && <span className="px-1 py-0.5 rounded bg-purple-500/15 text-[8px] text-purple-400 font-mono" title="Pricing page">💰</span>}
                              {entry.knowledgeSections.productsPage && <span className="px-1 py-0.5 rounded bg-yellow-500/15 text-[8px] text-yellow-400 font-mono" title="Products page">📦</span>}
                              {entry.knowledgeSections.newsResults && <span className="px-1 py-0.5 rounded bg-red-500/15 text-[8px] text-red-400 font-mono" title="News">📰</span>}
                              {entry.knowledgeSections.competitiveIntel && <span className="px-1 py-0.5 rounded bg-cyan-500/15 text-[8px] text-cyan-400 font-mono" title="Competitive intel">🎯</span>}
                            </div>
                          )}

                          <p className="text-[10px] text-white/30 mb-1">
                            <Clock size={9} className="inline mr-1" />
                            Watching since {timeAgo(entry.addedAt)}
                            {entry.lastChecked && <> · Checked {timeAgo(entry.lastChecked)}</>}
                            {entry.monitoredPages?.length > 0 && <> · {entry.monitoredPages.length} sources</>}
                          </p>
                          {entry.lastChange && (
                            <div className="mt-1.5 pl-2 border-l-2 border-orange-500/40">
                              <p className="text-[10px] text-orange-400/80 font-bold flex items-center gap-1">
                                <Bell size={9} /> Change detected {timeAgo(entry.lastChange.timestamp)}
                                {entry.lastChange.changedSection && <span className="text-white/30 font-normal"> · {entry.lastChange.changedSection}</span>}
                              </p>
                              <p className="text-[10px] text-white/50 leading-relaxed mt-0.5">
                                {entry.lastChange.summary.slice(0, 120)}{entry.lastChange.summary.length > 120 ? "..." : ""}
                              </p>
                            </div>
                          )}
                          {entry.notifyCount > 0 && (
                            <p className="text-[9px] text-white/20 mt-1">{entry.notifyCount} alert{entry.notifyCount !== 1 ? "s" : ""} total</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  <div className="px-3 pb-2">
                    <button
                      onClick={onToggleWatchMode}
                      className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                        isWatchMode
                          ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                          : "bg-white/5 text-white/50 border border-white/5 hover:bg-white/10"
                      }`}
                    >
                      {isWatchMode ? (
                        <>
                          <EyeOff size={14} /> Cancel watching
                        </>
                      ) : (
                        <>
                          <Plus size={14} /> Watch a startup
                        </>
                      )}
                    </button>
                    {isWatchMode && (
                      <p className="text-[10px] text-orange-400/60 text-center mt-1.5 animate-pulse">
                        Click a startup on the globe to add it
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* ── PRODUCTS TAB ── */}
              {activeTab === "products" && (
                <>
                  <div className="p-3 space-y-2">
                    {products.length === 0 && !showAddProduct ? (
                      <p className="text-xs text-white/30 text-center py-4">No products being tracked</p>
                    ) : (
                      products.map(product => (
                        <div key={product.id} className="bg-white/5 rounded-xl p-3 border border-white/5 group">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm">📦</span>
                              <span className="text-xs font-bold text-white truncate">{product.name}</span>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => onCheckProduct?.(product.id)}
                                className="px-1.5 py-0.5 rounded bg-purple-500/15 text-[9px] text-purple-400 font-mono hover:bg-purple-500/25 transition-colors"
                              >
                                <RefreshCw size={9} className="inline" />
                              </button>
                              <button
                                onClick={() => onRemoveProduct?.(product.id)}
                                className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-all"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </div>

                          {/* Price & status */}
                          {product.currentData && (
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-sm font-bold text-emerald-400">
                                {product.currentData.currency} {product.currentData.price ?? "—"}
                              </span>
                              {product.currentData.originalPrice && product.currentData.originalPrice > (product.currentData.price || 0) && (
                                <span className="text-[10px] text-white/30 line-through">
                                  {product.currentData.currency} {product.currentData.originalPrice}
                                </span>
                              )}
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                                product.currentData.availability === "in-stock"
                                  ? "bg-emerald-500/15 text-emerald-400"
                                  : product.currentData.availability === "out-of-stock"
                                  ? "bg-red-500/15 text-red-400"
                                  : "bg-yellow-500/15 text-yellow-400"
                              }`}>
                                {product.currentData.availability}
                              </span>
                              {product.currentData.rating && (
                                <span className="text-[9px] text-yellow-400">⭐ {product.currentData.rating}</span>
                              )}
                            </div>
                          )}

                          {/* Alert conditions */}
                          <div className="flex flex-wrap gap-1 mb-1">
                            {product.alertConditions.priceBelow && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-[8px] text-emerald-400 font-mono">
                                <DollarSign size={7} className="inline" /> Below {product.alertConditions.priceBelow}
                              </span>
                            )}
                            {product.alertConditions.priceDropPercent && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-[8px] text-blue-400 font-mono">
                                <ArrowDown size={7} className="inline" /> {product.alertConditions.priceDropPercent}% drop
                              </span>
                            )}
                            {product.alertConditions.backInStock && (
                              <span className="px-1.5 py-0.5 rounded bg-yellow-500/10 text-[8px] text-yellow-400 font-mono">
                                📦 Back in stock
                              </span>
                            )}
                            {product.alertConditions.anyChange && (
                              <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-[8px] text-purple-400 font-mono">
                                🔄 Any change
                              </span>
                            )}
                          </div>

                          <p className="text-[10px] text-white/30">
                            <Clock size={9} className="inline mr-1" />
                            Tracking since {timeAgo(product.addedAt)}
                            {product.lastChecked > 0 && <> · Checked {timeAgo(product.lastChecked)}</>}
                            {product.alertCount > 0 && <> · {product.alertCount} alert{product.alertCount !== 1 ? "s" : ""}</>}
                          </p>

                          {/* URL */}
                          <a
                            href={product.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[9px] text-purple-400/60 hover:text-purple-400 truncate block mt-1"
                          >
                            <Link2 size={8} className="inline mr-1" />{product.url.replace(/^https?:\/\//, "").slice(0, 40)}...
                          </a>
                        </div>
                      ))
                    )}

                    {/* Add product form */}
                    <AnimatePresence>
                      {showAddProduct && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="bg-white/5 rounded-xl p-3 border border-purple-500/20 space-y-2"
                        >
                          <input
                            type="text"
                            placeholder="Product name (e.g. MacBook Pro)"
                            value={productName}
                            onChange={e => setProductName(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50"
                          />
                          <input
                            type="url"
                            placeholder="Product URL (e.g. amazon.com/dp/...)"
                            value={productUrl}
                            onChange={e => setProductUrl(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50"
                          />
                          <input
                            type="number"
                            placeholder="Alert if price below (optional)"
                            value={priceAlert}
                            onChange={e => setPriceAlert(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={handleAddProduct}
                              disabled={!productUrl || !productName}
                              className="flex-1 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 text-xs font-bold hover:bg-purple-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              Track Product
                            </button>
                            <button
                              onClick={() => setShowAddProduct(false)}
                              className="px-3 py-1.5 rounded-lg bg-white/5 text-white/40 text-xs hover:bg-white/10 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="px-3 pb-2">
                    <button
                      onClick={() => setShowAddProduct(!showAddProduct)}
                      className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                        showAddProduct
                          ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                          : "bg-white/5 text-white/50 border border-white/5 hover:bg-white/10"
                      }`}
                    >
                      <Plus size={14} /> Track a product
                    </button>
                  </div>
                </>
              )}

              {/* Recent alerts */}
              {alerts.length > 0 && activeTab === "competitors" && (
                <div className="border-t border-white/5 p-3">
                  <h4 className="text-[10px] text-white/30 uppercase tracking-widest font-bold mb-2">Recent Alerts</h4>
                  <div className="space-y-1.5">
                    {alerts.slice(0, 5).map((alert, i) => (
                      <div key={i} className="flex items-start gap-2 group/alert">
                        <div className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${alert.acknowledged ? "bg-white/20" : "bg-orange-500"}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-white/60">
                            <span className="font-bold text-white/80">{alert.company}</span>
                            <span className="text-white/20 ml-1">{timeAgo(alert.timestamp)}</span>
                          </p>
                          <p className="text-[10px] text-white/40 truncate">{alert.summary}</p>
                        </div>
                        <button
                          onClick={() => onPlayAlert(alert.summary)}
                          className="opacity-0 group-hover/alert:opacity-100 text-white/20 hover:text-white/60 transition-all flex-shrink-0"
                        >
                          <Volume2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Competitors section tech badges */}
              {(entries.length > 0 || products.length > 0) && (
                <div className="border-t border-white/5 px-3 py-2 flex flex-wrap gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 font-mono text-[9px]">Firecrawl ×{entries.length + products.length}</span>
                  <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 font-mono text-[9px]">ElevenLabs TTS</span>
                  {products.length > 0 && <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-mono text-[9px]">Twilio Alerts</span>}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default WatchList;
