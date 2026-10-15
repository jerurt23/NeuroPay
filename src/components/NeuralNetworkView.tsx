import React, { useState, useEffect, useRef } from 'react';
import { 
 Network, 
 Sparkles, 
 Info, 
 Maximize2, 
 RotateCcw, 
 Zap, 
 ArrowRight, 
 CheckCircle2, 
 Filter, 
 ShieldCheck,
 TrendingUp,
 CircleDollarSign
} from 'lucide-react';
import { Transaction, CategoryInfo } from '../types/index.ts';

interface NeuralNode {
 id: string;
 label: string;
 type: 'core' | 'category' | 'merchant' | 'route' | 'bank';
 category?: string;
 x: number;
 y: number;
 radius: number;
 color: string;
 amount: number;
 count: number;
 details?: string;
}

interface NeuralSynapse {
 id: string;
 from: string;
 to: string;
 weight: number;
 color: string;
 label?: string;
}

interface NeuralNetworkViewProps {
 transactions: Transaction[];
 categories: CategoryInfo[];
 currencySymbol: string;
 onSelectCategory?: (category: string) => void;
}

export const NeuralNetworkView: React.FC<NeuralNetworkViewProps> = ({
 transactions,
 categories,
 currencySymbol,
}) => {
 const canvasRef = useRef<HTMLCanvasElement | null>(null);
 const containerRef = useRef<HTMLDivElement | null>(null);
 const [selectedNode, setSelectedNode] = useState<NeuralNode | null>(null);
 const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
 const [synapsePulse, setSynapsePulse] = useState(true);

 // Generate nodes & synapses from real transactions
 const nodesRef = useRef<NeuralNode[]>([]);
 const synapsesRef = useRef<NeuralSynapse[]>([]);
 const animationFrameRef = useRef<number | null>(null);

 // Build the neural network graph
 useEffect(() => {
 const width = 800;
 const height = 600;
 const centerX = width / 2;
 const centerY = height / 2;

 const nodes: NeuralNode[] = [];
 const synapses: NeuralSynapse[] = [];

 // Filter transactions if specific category selected
 const activeTransactions = selectedCategoryFilter === 'all'
 ? transactions
 : transactions.filter((t) => t.category === selectedCategoryFilter);

 const totalExpense = activeTransactions
 .filter((t) => t.type === 'expense')
 .reduce((sum, t) => sum + t.amount, 0);

 // 1. Central Core Node (Financial Synapse Hub)
 nodes.push({
 id: 'core-brain',
 label: 'Cerebro Financiero E2EE',
 type: 'core',
 x: centerX,
 y: centerY,
 radius: 36,
 color: '#0A84FF',
 amount: totalExpense,
 count: activeTransactions.length,
 details: 'Núcleo central de procesamiento y enrutamiento inteligente de flujos de capital.',
 });

 // 2. Category Nodes (Orbiting layer 1)
 const categoryTotals: Record<string, { total: number; count: number; name: string; color: string }> = {};
 for (const cat of categories) {
 categoryTotals[cat.id] = { total: 0, count: 0, name: cat.name, color: cat.color };
 }

 for (const t of activeTransactions) {
 if (t.type === 'expense' && categoryTotals[t.category]) {
 categoryTotals[t.category].total += t.amount;
 categoryTotals[t.category].count += 1;
 }
 }

 const visibleCats = categories.filter((c) => selectedCategoryFilter === 'all' || selectedCategoryFilter === c.id);
 const catAngleStep = (Math.PI * 2) / Math.max(1, visibleCats.length);

 visibleCats.forEach((cat, index) => {
 const angle = index * catAngleStep;
 const radiusDist = 170;
 const nx = centerX + Math.cos(angle) * radiusDist;
 const ny = centerY + Math.sin(angle) * radiusDist;

 const catData = categoryTotals[cat.id] || { total: 0, count: 0, name: cat.name, color: cat.color };
 const nodeRadius = Math.max(18, Math.min(32, 16 + (catData.total / Math.max(1, totalExpense)) * 25));

 nodes.push({
 id: `cat-${cat.id}`,
 label: cat.name.split(' ')[0],
 type: 'category',
 category: cat.id,
 x: nx,
 y: ny,
 radius: nodeRadius,
 color: cat.color,
 amount: catData.total,
 count: catData.count,
 details: `Sub-red neuronal para ${cat.name}. Conecta compras, hábitos y presupuesto asignado.`,
 });

 // Synapse from core to category
 synapses.push({
 id: `syn-core-${cat.id}`,
 from: 'core-brain',
 to: `cat-${cat.id}`,
 weight: Math.max(1, Math.min(5, (catData.total / Math.max(1, totalExpense)) * 6)),
 color: cat.color,
 label: `${currencySymbol}${catData.total.toFixed(0)}`,
 });
 });

 // 3. Leaf Nodes (Merchants, Transport routes, and Bank email originators)
 const uniqueLeaves = new Map<string, { label: string; type: 'route' | 'merchant' | 'bank'; category: string; amount: number; count: number; details: string }>();

 for (const t of activeTransactions.slice(0, 15)) {
 if (t.transportDetails) {
 const routeKey = `route-${t.transportDetails.origin.split(',')[0]}-${t.transportDetails.destination.split(',')[0]}`;
 const label = `${t.transportDetails.origin.split(',')[0]} ➔ ${t.transportDetails.destination.split(',')[0]}`;
 uniqueLeaves.set(routeKey, {
 label,
 type: 'route',
 category: 'transporte',
 amount: t.amount,
 count: 1,
 details: `Ruta punto a punto: ${t.transportDetails.origin} hasta ${t.transportDetails.destination}. Distancia: ${t.transportDetails.distanceKm || 5} km. Modo: ${t.transportDetails.transportMode}.`,
 });
 } else if (t.medicineDetails) {
 const medKey = `med-${t.medicineDetails.pharmacy || t.title}`;
 uniqueLeaves.set(medKey, {
 label: t.medicineDetails.pharmacy || t.title.split(':')[0],
 type: 'merchant',
 category: 'medicina',
 amount: t.amount,
 count: 1,
 details: `Dispensario médico: ${t.title}. Indicaciones: ${t.medicineDetails.doseNotes || 'Tratamiento activo'}.`,
 });
 } else if (t.bankSyncMeta) {
 const bankKey = `bank-${t.bankSyncMeta.bankName}`;
 uniqueLeaves.set(bankKey, {
 label: `${t.bankSyncMeta.bankName} Alert`,
 type: 'bank',
 category: t.category,
 amount: t.amount,
 count: 1,
 details: `Nodo de alerta bancaria automática sincronizada desde correo personal: ${t.bankSyncMeta.emailSender}.`,
 });
 }
 }

 let leafIndex = 0;
 const totalLeaves = uniqueLeaves.size;
 const leafAngleStep = (Math.PI * 2) / Math.max(1, totalLeaves);

 uniqueLeaves.forEach((leaf, key) => {
 const angle = leafIndex * leafAngleStep + 0.3;
 const leafDist = 270;
 const lx = centerX + Math.cos(angle) * leafDist;
 const ly = centerY + Math.sin(angle) * leafDist;

 const parentCatNode = nodes.find((n) => n.id === `cat-${leaf.category}`) || nodes[0];
 const leafColor = parentCatNode.color || '#30D158';

 nodes.push({
 id: key,
 label: leaf.label,
 type: leaf.type,
 category: leaf.category,
 x: lx,
 y: ly,
 radius: 14,
 color: leafColor,
 amount: leaf.amount,
 count: leaf.count,
 details: leaf.details,
 });

 // Synapse from parent category to leaf
 synapses.push({
 id: `syn-${parentCatNode.id}-${key}`,
 from: parentCatNode.id,
 to: key,
 weight: 1.5,
 color: leafColor,
 });

 leafIndex++;
 });

 nodesRef.current = nodes;
 synapsesRef.current = synapses;
 }, [transactions, categories, selectedCategoryFilter, currencySymbol]);

 // Canvas render loop with animated electrical synapse impulses
 useEffect(() => {
 const canvas = canvasRef.current;
 if (!canvas) return;
 const ctx = canvas.getContext('2d');
 if (!ctx) return;

 let pulseOffset = 0;

 const render = () => {
 pulseOffset = (pulseOffset + 0.015) % 1;
 ctx.clearRect(0, 0, canvas.width, canvas.height);

 const nodes = nodesRef.current;
 const synapses = synapsesRef.current;
 const nodeMap = new Map(nodes.map((n) => [n.id, n]));

 // 1. Draw Synaptic Edges
 for (const syn of synapses) {
 const source = nodeMap.get(syn.from);
 const target = nodeMap.get(syn.to);
 if (!source || !target) continue;

 const isHighlight = selectedNode && (selectedNode.id === source.id || selectedNode.id === target.id);

 ctx.beginPath();
 ctx.moveTo(source.x, source.y);
 ctx.lineTo(target.x, target.y);
 ctx.strokeStyle = isHighlight ? syn.color : `${syn.color}33`; // alpha
 ctx.lineWidth = isHighlight ? syn.weight * 2 : syn.weight;
 ctx.stroke();

 // Animated neural energy impulses flowing through axons
 if (synapsePulse) {
 const impulseCount = 2;
 for (let i = 0; i < impulseCount; i++) {
 const t = (pulseOffset + i / impulseCount) % 1;
 const px = source.x + (target.x - source.x) * t;
 const py = source.y + (target.y - source.y) * t;

 ctx.beginPath();
 ctx.arc(px, py, isHighlight ? 3.5 : 2, 0, Math.PI * 2);
 ctx.fillStyle = isHighlight ? '#FFFFFF' : syn.color;
 ctx.shadowColor = syn.color;
 ctx.shadowBlur = 8;
 ctx.fill();
 ctx.shadowBlur = 0; // reset
 }
 }
 }

 // 2. Draw Nodes
 for (const node of nodes) {
 const isSelected = selectedNode?.id === node.id;

 // Outer glow
 ctx.beginPath();
 ctx.arc(node.x, node.y, node.radius + (isSelected ? 8 : 4), 0, Math.PI * 2);
 ctx.fillStyle = `${node.color}22`;
 ctx.fill();

 // Node Body
 ctx.beginPath();
 ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
 ctx.fillStyle = isSelected ? '#FFFFFF' : node.color;
 ctx.shadowColor = node.color;
 ctx.shadowBlur = isSelected ? 15 : 6;
 ctx.fill();
 ctx.shadowBlur = 0;

 // Inner ring
 ctx.beginPath();
 ctx.arc(node.x, node.y, node.radius * 0.7, 0, Math.PI * 2);
 ctx.fillStyle = isSelected ? node.color : '#00000033';
 ctx.fill();

 // Label
 ctx.font = node.type === 'core' ? 'bold 12px -apple-system, sans-serif' : '10px -apple-system, sans-serif';
 ctx.fillStyle = isSelected ? '#0A84FF' : '#FFFFFF';
 ctx.textAlign = 'center';
 ctx.textBaseline = 'middle';
 
 // Show short text inside or beneath
 if (node.type === 'core') {
 ctx.fillText('NÚCLEO', node.x, node.y);
 } else {
 // Label underneath
 ctx.font = '10px -apple-system, sans-serif';
 ctx.fillStyle = '#A1A1AA';
 const truncated = node.label.length > 14 ? node.label.slice(0, 12) + '...' : node.label;
 ctx.fillText(truncated, node.x, node.y + node.radius + 12);
 }
 }

 animationFrameRef.current = requestAnimationFrame(render);
 };

 render();

 return () => {
 if (animationFrameRef.current) {
 cancelAnimationFrame(animationFrameRef.current);
 }
 };
 }, [selectedNode, synapsePulse]);

 // Handle Canvas Click to select node
 const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
 const canvas = canvasRef.current;
 if (!canvas) return;
 const rect = canvas.getBoundingClientRect();
 const scaleX = canvas.width / rect.width;
 const scaleY = canvas.height / rect.height;

 const clickX = (e.clientX - rect.left) * scaleX;
 const clickY = (e.clientY - rect.top) * scaleY;

 // Check hit test
 for (const node of nodesRef.current) {
 const dist = Math.hypot(clickX - node.x, clickY - node.y);
 if (dist <= node.radius + 6) {
 setSelectedNode(node);
 return;
 }
 }

 // Deselect if clicked empty area
 setSelectedNode(null);
 };

 return (
 <div className="space-y-4">
 {/* Top Controls & Category Filters */}
 <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-3xl ios-glass-card">
 <div className="flex items-center gap-2">
 <div className="p-2 rounded-2xl bg-blue-500/10 text-blue-500">
 <Network className="w-5 h-5" />
 </div>
 <div>
 <h2 className="text-base font-bold text-zinc-900100 flex items-center gap-2">
 Red Neuronal Financiera
 <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600400 border border-emerald-500/20">
 Sinapsis Activa
 </span>
 </h2>
 <p className="text-xs text-zinc-500400">
 Correlación sináptica entre compras, rutas de transporte, medicina y alertas bancarias.
 </p>
 </div>
 </div>

 {/* Filter Pills */}
 <div className="flex items-center gap-1.5 flex-wrap">
 <button
 type="button"
 onClick={() => setSelectedCategoryFilter('all')}
 className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
 selectedCategoryFilter === 'all'
 ? 'bg-blue-600 text-white shadow-md'
 : 'bg-zinc-100800 text-zinc-600400 hover:bg-zinc-200:bg-zinc-700'
 }`}
 >
 Todas ({transactions.length})
 </button>
 {categories.slice(0, 5).map((cat) => (
 <button
 key={cat.id}
 type="button"
 onClick={() => setSelectedCategoryFilter(cat.id)}
 className={`px-2.5 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
 selectedCategoryFilter === cat.id
 ? 'bg-zinc-900 text-white100900 shadow-md'
 : 'bg-zinc-100800 text-zinc-600400 hover:bg-zinc-200:bg-zinc-700'
 }`}
 >
 <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
 {cat.name.split(' ')[0]}
 </button>
 ))}
 <button
 type="button"
 onClick={() => setSynapsePulse(!synapsePulse)}
 title={synapsePulse ? 'Pausar impulsos' : 'Activar impulsos sinápticos'}
 aria-label="Toggle Impulsos"
 className={`p-1.5 rounded-full ${
 synapsePulse ? 'bg-amber-500/20 text-amber-500' : 'bg-zinc-100800 text-zinc-400'
 }`}
 >
 <Zap className="w-4 h-4" />
 </button>
 </div>
 </div>

 {/* Main Graph Canvas & Inspection Panel */}
 <div className="relative rounded-3xl ios-glass-card overflow-hidden p-2 min-h-[520px] flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100950900">
 <canvas
 ref={canvasRef}
 width={800}
 height={600}
 onClick={handleCanvasClick}
 className="w-full max-w-3xl h-[480px] sm:h-[540px] cursor-pointer touch-none"
 />

 {/* Overlay Helper Instruction */}
 {!selectedNode && (
 <div className="absolute top-4 left-4 pointer-events-none flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 text-white text-[11px] backdrop-blur-md">
 <Sparkles className="w-3.5 h-3.5 text-blue-400" />
 <span>Haz clic en cualquier nodo o sinapsis para inspeccionar correlaciones</span>
 </div>
 )}

 {/* Node Inspection Floating Drawer / Card */}
 {selectedNode && (
 <div
 className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 rounded-2xl p-4 bg-white/95900/95 border border-zinc-200800 shadow-2xl backdrop-blur-xl z-20 animate-in fade-in slide-in-from-bottom-3 duration-200"
 >
 <div className="flex items-start justify-between gap-2 mb-2">
 <div className="flex items-center gap-2">
 <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: selectedNode.color }} />
 <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-400">
 Nodo {selectedNode.type}
 </span>
 </div>
 <button
 type="button"
 onClick={() => setSelectedNode(null)}
 className="text-zinc-400 hover:text-zinc-600:text-zinc-200 text-xs px-2 py-0.5 rounded-full hover:bg-zinc-100:bg-zinc-800"
 >
 Cerrar
 </button>
 </div>

 <h3 className="text-base font-bold text-zinc-900100 mb-1">
 {selectedNode.label}
 </h3>
 <p className="text-xs text-zinc-600400 mb-3 leading-relaxed">
 {selectedNode.details}
 </p>

 <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-100800">
 <div className="p-2 rounded-xl bg-zinc-50800/60">
 <span className="text-[10px] text-zinc-400 block font-medium">Volumen Transaccionado</span>
 <span className="text-sm font-bold text-zinc-900100 font-mono">
 {currencySymbol}{selectedNode.amount.toFixed(2)}
 </span>
 </div>
 <div className="p-2 rounded-xl bg-zinc-50800/60">
 <span className="text-[10px] text-zinc-400 block font-medium">Conexiones Activas</span>
 <span className="text-sm font-bold text-blue-600400">
 {selectedNode.count} enlaces
 </span>
 </div>
 </div>
 </div>
 )}
 </div>
 </div>
 );
};
