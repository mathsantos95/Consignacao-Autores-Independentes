/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  PackagePlus,
  ShoppingCart,
  RotateCcw,
  FileText,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  MoreVertical,
  Printer,
  Wallet,
  TrendingUp,
  DollarSign,
  Download,
  Trash2,
  Pencil,
  Undo2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import * as XLSX from 'xlsx';
import { Author, Book, InventoryItem, Settlement, Consignment, Return as ReturnType } from './types';

// --- Components ---

const InfoSection = ({ title, items }: { title: string, items: string[] }) => (
  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6">
    <h4 className="flex items-center gap-2 text-indigo-800 font-bold text-sm mb-2">
      <AlertCircle size={16} /> {title}
    </h4>
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i} className="text-indigo-600 text-xs flex items-start gap-2">
          <span className="mt-1 w-1 h-1 rounded-full bg-indigo-400 shrink-0" />
          {item}
        </li>
      ))}
    </ul>
  </div>
);

const SidebarItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active
      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
      : 'text-slate-500 hover:bg-slate-100'
      }`}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </button>
);

const StatCard = ({ label, value, icon: Icon, color }: { label: string, value: string | number, icon: any, color: string }) => (
  <div className="card p-6 flex items-center gap-4">
    <div className={`p-3 rounded-xl ${color}`}>
      <Icon size={24} className="text-white" />
    </div>
    <div>
      <p className="text-sm text-slate-500 font-medium">{label}</p>
      <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
    </div>
  </div>
);

const Modal = ({ title, children, onClose, onSubmit }: { title: string, children: React.ReactNode, onClose: () => void, onSubmit: (e: React.FormEvent) => void }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
    >
      <div className="p-6 border-b border-slate-100 flex justify-between items-center">
        <h3 className="text-xl font-bold text-slate-800">{title}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">&times;</button>
      </div>
      <form onSubmit={onSubmit} className="p-6 space-y-4">
        {children}
        <div className="pt-4 flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button type="submit" className="btn-primary flex-1">Salvar</button>
        </div>
      </form>
    </motion.div>
  </div>
);

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [authors, setAuthors] = useState<Author[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [consignments, setConsignments] = useState<Consignment[]>([]);
  const [returns, setReturns] = useState<ReturnType[]>([]);
  const [generalSales, setGeneralSales] = useState<any[]>([]);
  const [allSales, setAllSales] = useState<any[]>([]);
  const [allGeneralSales, setAllGeneralSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inventoryTab, setInventoryTab] = useState<'stock' | 'entries' | 'returns'>('stock');
  const [printData, setPrintData] = useState<any>(null);
  const [editingSettlement, setEditingSettlement] = useState<Settlement | null>(null);
  const [editingGeneralSale, setEditingGeneralSale] = useState<any | null>(null);

  // --- CSV Export Utility ---
  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]).join(';');
    const rows = data.map(obj =>
      Object.values(obj).map(val =>
        typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val
      ).join(';')
    );

    const csvContent = "\uFEFF" + [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportExcel = async (type: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx, .xls, .csv';

    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();

      reader.onload = async (evt: any) => {
        try {
          const dataArr = new Uint8Array(evt.target.result);
          const wb = XLSX.read(dataArr, { type: 'array' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws);

          if (data.length === 0) {
            alert("O arquivo parece estar vazio.");
            return;
          }

          const res = await fetch(`/api/${type}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });

          if (res.ok) {
            const result = await res.json();
            if (type === 'sales/unified-import') {
              alert(`Importação Unificada concluída!\n- ${result.consignmentCount} vendas de autores identificadas.\n- Vendas gerais processadas para ${result.generalDates} datas.`);
            } else {
              alert(`Importação de ${data.length} registros concluída com sucesso!`);
            }
            fetchData();
          } else {
            const contentType = res.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
              const errorData = await res.json();
              alert(`Erro na importação: ${errorData.error || "Verifique o formato do arquivo."}`);
            } else {
              const text = await res.text();
              console.error("Erro do servidor (não-JSON):", text);
              alert(`Erro no servidor (${res.status}). O arquivo pode ser grande demais ou o formato é inválido.`);
            }
          }
        } catch (error) {
          console.error("Erro ao processar Excel:", error);
          alert("Erro ao processar o arquivo Excel. Verifique se o formato é válido.");
        }
      };

      reader.onerror = (error) => {
        console.error("Erro na leitura do arquivo:", error);
        alert("Erro ao ler o arquivo.");
      };

      reader.readAsArrayBuffer(file);
    };

    input.click();
  };

  const downloadTemplate = (type: string) => {
    let data: any[] = [];
    let filename = "";

    if (type === 'authors') {
      data = [{
        name: "João Silva",
        phone: "(11) 99999-9999",
        email: "joao@exemplo.com",
        pix_key: "123.456.789-00",
        notes: "Autor de ficção científica"
      }];
      filename = "modelo_autores";
    } else if (type === 'books') {
      data = [{
        title: "Minha Grande Obra",
        isbn: "978-3-16-148410-0",
        author_id: 1,
        cover_price: 49.90,
        repasse_type: "percent",
        repasse_value: 60,
        category: "Ficção",
        notes: "Referência de author_id disponível na lista de autores"
      }];
      filename = "modelo_livros";
    } else if (type === 'sales') {
      data = [{
        isbn: "978-3-16-148410-0",
        quantity: 1,
        sale_price: 49.90,
        sale_date: new Date().toISOString().split('T')[0],
        channel: "loja"
      }];
      filename = "modelo_vendas_unificadas";
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modelo");
    XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  // Form states
  const [showModal, setShowModal] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [settlementPreview, setSettlementPreview] = useState<any>(null);
  const [activeMenu, setActiveMenu] = useState<{ type: string, id: number } | null>(null);

  const openModal = (type: string, initialData: any = {}) => {
    setFormData(initialData);
    setShowModal(type);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const today = new Date();
    const sixMonthsAgo = new Date(today);
    sixMonthsAgo.setMonth(today.getMonth() - 6);

    const startDate = sixMonthsAgo.toISOString().split('T')[0];
    const endDate = today.toISOString().split('T')[0];

    try {
      const [authorsRes, booksRes, invRes, setRes, conRes, retRes, genSalesRes, salesRes, allSalesRes, allGenSalesRes] = await Promise.all([
        fetch('/api/authors'),
        fetch('/api/books'),
        fetch('/api/inventory'),
        fetch('/api/settlements'),
        fetch('/api/consignments'),
        fetch('/api/returns'),
        fetch(`/api/general-sales?start_date=${startDate}&end_date=${endDate}`),
        fetch(`/api/reports/sales?start_date=${startDate}&end_date=${endDate}`),
        fetch('/api/sales'),
        fetch('/api/general-sales')
      ]);

      const authors = await authorsRes.json();
      const books = (await booksRes.json()).map((b: any) => ({
        ...b,
        cover_price: Number(b.cover_price),
        repasse_value: Number(b.repasse_value)
      }));
      const inventory = (await invRes.json()).map((i: any) => ({
        ...i,
        received: Number(i.received),
        sold: Number(i.sold),
        returned: Number(i.returned),
        stock: Number(i.stock),
        cover_price: Number(i.cover_price),
        repasse_value: Number(i.repasse_value)
      }));
      const settlements = (await setRes.json()).map((s: any) => ({
        ...s,
        total_gross: Number(s.total_gross),
        total_repasse: Number(s.total_repasse),
        total_units: Number(s.total_units)
      }));
      const consignments = await conRes.json();
      const returns = await retRes.json();
      const generalSales = (await genSalesRes.json()).map((s: any) => ({
        ...s,
        amount: Number(s.amount)
      }));
      const allSales = (await allSalesRes.json()).map((s: any) => ({
        ...s,
        sale_price: Number(s.sale_price),
        quantity: Number(s.quantity)
      }));
      const allGeneralSales = (await allGenSalesRes.json()).map((s: any) => ({
        ...s,
        amount: Number(s.amount)
      }));

      setAuthors(authors);
      setBooks(books);
      setInventory(inventory);
      setSettlements(settlements);
      setConsignments(consignments);
      setReturns(returns);
      setGeneralSales(generalSales);
      setAllSales(allSales);
      setAllGeneralSales(allGeneralSales);

      // We'll use salesRes for the chart too
      const consignmentSales = (await salesRes.json()).map((s: any) => ({
        ...s,
        sale_price: Number(s.sale_price),
        quantity: Number(s.quantity)
      }));
      (window as any).consignmentSales = consignmentSales; // Temporary store for chart logic
    } catch (error: any) {
      console.error("Error fetching data:", error);
      alert(`Erro ao buscar dados: ${error.message}`);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent, endpoint: string) => {
    e.preventDefault();
    const isEdit = !!formData.id;
    const url = isEdit ? `/api/${endpoint}/${formData.id}` : `/api/${endpoint}`;
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setShowModal(null);
        setFormData({});
        setSettlementPreview(null);
        fetchData();
      } else {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const err = await res.json();
          alert(err.error || "Erro ao salvar");
        } else {
          const text = await res.text();
          alert(`Erro do servidor (${res.status}): ${text.slice(0, 100)}`);
        }
      }
    } catch (error: any) {
      alert(`Erro de conexão: ${error.message}`);
    }
  };

  const handleDelete = async (endpoint: string, id: number) => {
    if (!confirm("Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.")) return;

    try {
      const res = await fetch(`/api/${endpoint}/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      if (res.ok) {
        await fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Erro ao excluir o registro.");
      }
    } catch (error: any) {
      console.error("Erro ao deletar:", error);
      alert(`Erro de conexão: ${error.message}`);
    }
  };

  const handlePaySettlement = async (id: number) => {
    const payment_date = new Date().toISOString().split('T')[0];
    const payment_method = prompt("Forma de pagamento (PIX, Dinheiro, etc):", "PIX");
    if (!payment_method) return;

    try {
      await fetch(`/api/settlements/${id}/pay`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_date, payment_method })
      });
      fetchData();
    } catch (error: any) {
      alert(`Erro ao processar pagamento: ${error.message}`);
    }
  };

  const handleToggleSettlementStatus = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'paid' ? 'pending' : 'paid';
    const confirmMsg = newStatus === 'pending'
      ? "Deseja desfazer o pagamento e marcar como pendente?"
      : "Deseja marcar este acerto como pago?";

    if (!confirm(confirmMsg)) return;

    try {
      await fetch(`/api/settlements/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      fetchData();
    } catch (error: any) {
      alert(`Erro ao alterar status: ${error.message}`);
    }
  };

  const handleUpdateSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSettlement) return;
    try {
      const res = await fetch(`/api/settlements/${editingSettlement.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingSettlement)
      });
      if (res.ok) {
        setEditingSettlement(null);
        fetchData();
      }
    } catch (error: any) {
      alert(`Erro ao atualizar acerto: ${error.message}`);
    }
  };

  const handleUpdateGeneralSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGeneralSale) return;
    try {
      const res = await fetch(`/api/general-sales/${editingGeneralSale.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingGeneralSale)
      });
      if (res.ok) {
        setEditingGeneralSale(null);
        fetchData();
      }
    } catch (error: any) {
      alert(`Erro ao atualizar venda: ${error.message}`);
    }
  };

  const fetchSettlementPreview = async () => {
    if (!formData.author_id || !formData.start_date || !formData.end_date) {
      alert("Preencha autor e datas");
      return;
    }
    const res = await fetch(`/api/settlements/preview?author_id=${formData.author_id}&start_date=${formData.start_date}&end_date=${formData.end_date}`);
    const data = await res.json();
    setSettlementPreview(data);
    setFormData({
      ...formData,
      total_gross: data.totalGross,
      total_repasse: data.totalRepasse,
      sale_ids: data.items.map((i: any) => i.id)
    });
  };

  const renderDashboard = () => {
    const totalStock = inventory.reduce((acc, item) => acc + item.stock, 0);
    const pendingSettlements = settlements.filter(s => s.status === 'pending').length;
    const totalValue = inventory.reduce((acc, item) => {
      const book = books.find(b => b.id === item.id);
      return acc + (item.stock * (book?.cover_price || 0));
    }, 0);

    // Prepare chart data
    const consignmentSales = (window as any).consignmentSales || [];
    const chartDataMap: Record<string, { month: string, consignment: number, general: number }> = {};

    // Last 6 months for the chart
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      chartDataMap[monthStr] = { month: monthStr, consignment: 0, general: 0 };
    }

    consignmentSales.forEach((s: any) => {
      const monthStr = (s.sale_date || s.date || "").substring(0, 7);
      if (chartDataMap[monthStr]) {
        chartDataMap[monthStr].consignment += s.quantity * (s.sale_price || s.price || 0);
      }
    });

    generalSales.forEach((s: any) => {
      const monthStr = (s.sale_date || s.date || "").substring(0, 7);
      if (chartDataMap[monthStr]) {
        chartDataMap[monthStr].general += s.amount;
      }
    });

    const chartData = Object.values(chartDataMap);

    return (
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-800">Visão Geral</h2>
          <div className="flex gap-3">
            <button onClick={() => downloadTemplate('sales')} className="btn-secondary flex items-center gap-2 text-sm">
              <Download size={16} /> Baixar Modelo
            </button>
            <button onClick={() => handleImportExcel('sales/unified-import')} className="btn-primary flex items-center gap-2 text-sm shadow-lg shadow-indigo-100">
              <FileText size={16} /> Importar Vendas Unificadas (Excel)
            </button>
            <button onClick={() => setShowModal('general_sale')} className="btn-secondary flex items-center gap-2 text-sm">
              <DollarSign size={16} /> Lançar Venda Manual
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard label="Livros em Estoque" value={totalStock} icon={BookOpen} color="bg-blue-500" />
          <StatCard label="Valor em Consignação" value={`R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={ShoppingCart} color="bg-emerald-500" />
          <StatCard label="Acertos Pendentes" value={pendingSettlements} icon={Clock} color="bg-amber-500" />
        </div>

        <div className="card p-6">
          <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
            <TrendingUp size={20} className="text-indigo-600" />
            Desempenho de Vendas (Últimos 6 meses)
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  tickFormatter={(str) => {
                    const [year, month] = str.split('-');
                    const date = new Date(parseInt(year), parseInt(month) - 1);
                    return date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
                  }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  tickFormatter={(val) => `R$ ${val}`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`R$ ${value.toFixed(2)}`, '']}
                />
                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px' }} />
                <Bar dataKey="general" name="Vendas Gerais Loja" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="consignment" name="Vendas Autores Independentes" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="card">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-800">Estoque por Autor</h3>
                <button onClick={() => setActiveTab('inventory')} className="text-indigo-600 text-sm font-medium hover:underline">Ver tudo</button>
              </div>
              <div className="divide-y divide-slate-50">
                {authors.slice(0, 5).map(author => {
                  const authorStock = inventory
                    .filter(i => i.author_name === author.name)
                    .reduce((acc, i) => acc + i.stock, 0);
                  return (
                    <div key={author.id} className="p-4 flex justify-between items-center">
                      <div>
                        <p className="font-medium text-slate-700">{author.name}</p>
                        <p className="text-xs text-slate-400">{author.email}</p>
                      </div>
                      <span className="px-3 py-1 bg-slate-100 rounded-full text-sm font-bold text-slate-600">
                        {authorStock} un.
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-800">Vendas Recentes</h3>
                <button onClick={() => setActiveTab('sales_history')} className="text-indigo-600 text-sm font-medium hover:underline">Ver histórico</button>
              </div>
              <div className="divide-y divide-slate-50">
                {allSales.slice(0, 5).map(sale => (
                  <div key={sale.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                        <ShoppingCart size={14} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700">{sale.title}</p>
                        <p className="text-[10px] text-slate-400">{new Date(sale.sale_date || sale.date).toLocaleDateString('pt-BR')} • {sale.author_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-sm font-bold text-slate-700">R$ {(sale.sale_price || sale.price || 0).toFixed(2)}</p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete('sales', sale.id);
                        }}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 transition-all"
                        disabled={!!sale.settlement_id}
                      >
                        <Trash2 size={14} className={sale.settlement_id ? 'opacity-10' : ''} />
                      </button>
                    </div>
                  </div>
                ))}
                {allSales.length === 0 && (
                  <div className="p-8 text-center text-slate-400 italic text-sm">Nenhuma venda recente.</div>
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Últimos Acertos</h3>
              <button onClick={() => setActiveTab('settlements')} className="text-indigo-600 text-sm font-medium hover:underline">Ver tudo</button>
            </div>
            <div className="divide-y divide-slate-50">
              {settlements.slice(0, 5).map(s => (
                <div key={s.id} className="p-4 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-slate-700">{s.author_name}</p>
                    <p className="text-xs text-slate-400">{new Date(s.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-800">R$ {s.total_repasse.toFixed(2)}</p>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${s.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {s.status === 'paid' ? 'Pago' : 'Pendente'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAuthors = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Autores</h2>
        <div className="flex gap-3">
          <button onClick={() => downloadTemplate('authors')} className="btn-secondary flex items-center gap-2 text-sm">
            <Download size={16} /> Baixar Modelo
          </button>
          <button onClick={() => handleImportExcel('authors/bulk')} className="btn-secondary flex items-center gap-2 text-sm">
            <Plus size={16} /> Importar Excel
          </button>
          <button onClick={() => exportToCSV(authors, 'autores')} className="btn-secondary flex items-center gap-2 text-sm">
            <Download size={16} /> Exportar
          </button>
          <button onClick={() => openModal('author')} className="btn-primary flex items-center gap-2">
            <Plus size={18} /> Novo Autor
          </button>
        </div>
      </div>

      <InfoSection
        title="Orientação para Importação de Autores"
        items={[
          "Colunas necessárias: name, phone, email, pix_key, notes",
          "O campo 'name' é obrigatório para cada registro.",
          "Use o modelo .xlsx para garantir a estrutura correta."
        ]}
      />
      <div className="card">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600">Nome</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600">Contato</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600">PIX</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {authors.map(author => (
              <tr key={author.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-medium">{author.name}</td>
                <td className="px-6 py-4 text-sm text-slate-500">
                  {author.phone}<br />{author.email}
                </td>
                <td className="px-6 py-4 text-sm font-mono text-slate-600">{author.pix_key}</td>
                <td className="px-6 py-4 relative">
                  <button
                    onClick={() => setActiveMenu(activeMenu?.id === author.id && activeMenu?.type === 'author' ? null : { type: 'author', id: author.id })}
                    className="text-slate-400 hover:text-indigo-600"
                  >
                    <MoreVertical size={18} />
                  </button>
                  {activeMenu?.id === author.id && activeMenu?.type === 'author' && (
                    <div className="absolute right-0 mt-2 w-32 bg-white rounded-lg shadow-xl border border-slate-100 z-10 overflow-hidden">
                      <button
                        onClick={() => { openModal('author', author); setActiveMenu(null); }}
                        className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => { handleDelete('authors', author.id); setActiveMenu(null); }}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        Excluir
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderBooks = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Livros</h2>
        <div className="flex gap-3">
          <button onClick={() => downloadTemplate('books')} className="btn-secondary flex items-center gap-2 text-sm">
            <Download size={16} /> Baixar Modelo
          </button>
          <button onClick={() => handleImportExcel('books/bulk')} className="btn-secondary flex items-center gap-2 text-sm">
            <Plus size={16} /> Importar Excel
          </button>
          <button onClick={() => exportToCSV(books, 'livros')} className="btn-secondary flex items-center gap-2 text-sm">
            <Download size={16} /> Exportar
          </button>
          <button onClick={() => openModal('book', { repasse_type: 'percent' })} className="btn-primary flex items-center gap-2">
            <Plus size={18} /> Novo Livro
          </button>
        </div>
      </div>

      <InfoSection
        title="Orientação para Importação de Livros"
        items={[
          "Campos obrigatórios: title, author_id, repasse_type, repasse_value",
          "repasse_type deve ser 'fixed' (valor fixo) ou 'percent' (porcentagem).",
          "author_id: Consulte o ID numérico na aba de Autores.",
          "O campo ISBN é recomendado para facilitar a importação de vendas."
        ]}
      />
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Título</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Autor</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Preço Capa</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Repasse</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Categoria</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {books.map(book => (
                <tr key={book.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium">{book.title}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{book.author_name}</td>
                  <td className="px-6 py-4 text-sm">R$ {Number(book.cover_price || 0).toFixed(2)}</td>
                  <td className="px-6 py-4 text-sm">
                    {book.repasse_type === 'fixed' ? `R$ ${Number(book.repasse_value || 0).toFixed(2)}` : `${book.repasse_value}%`}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className="px-2 py-1 bg-slate-100 rounded text-xs text-slate-600">{book.category}</span>
                  </td>
                  <td className="px-6 py-4 relative">
                    <button
                      onClick={() => setActiveMenu(activeMenu?.id === book.id && activeMenu?.type === 'book' ? null : { type: 'book', id: book.id })}
                      className="text-slate-400 hover:text-indigo-600"
                    >
                      <MoreVertical size={18} />
                    </button>
                    {activeMenu?.id === book.id && activeMenu?.type === 'book' && (
                      <div className="absolute right-0 mt-2 w-32 bg-white rounded-lg shadow-xl border border-slate-100 z-10 overflow-hidden">
                        <button
                          onClick={() => { openModal('book', book); setActiveMenu(null); }}
                          className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                        >
                          <Pencil size={14} /> Editar
                        </button>
                        <button
                          onClick={() => { handleDelete('books', book.id); setActiveMenu(null); }}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <Trash2 size={14} /> Excluir
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderInventory = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Estoque e Movimentação</h2>
        <div className="flex gap-3">
          <button onClick={() => {
            const data = inventoryTab === 'stock' ? inventory : (inventoryTab === 'entries' ? consignments : returns);
            exportToCSV(data, `estoque_${inventoryTab}`);
          }} className="btn-secondary flex items-center gap-2 text-sm">
            <Download size={16} /> Exportar CSV
          </button>
          <button onClick={() => openModal('consignment', { entry_date: new Date().toISOString().split('T')[0] })} className="btn-secondary flex items-center gap-2 text-sm">
            <PackagePlus size={16} /> Entrada
          </button>
          <button onClick={() => openModal('return', { return_date: new Date().toISOString().split('T')[0] })} className="btn-secondary flex items-center gap-2 text-sm">
            <RotateCcw size={16} /> Devolução
          </button>
          <button onClick={() => openModal('sale', { sale_date: new Date().toISOString().split('T')[0], channel: 'loja' })} className="btn-primary flex items-center gap-2 text-sm">
            <ShoppingCart size={16} /> Venda
          </button>
        </div>
      </div>

      <div className="flex gap-4 border-b border-slate-200">
        <button
          onClick={() => setInventoryTab('stock')}
          className={`pb-2 px-1 text-sm font-medium transition-colors ${inventoryTab === 'stock' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Estoque Atual
        </button>
        <button
          onClick={() => setInventoryTab('entries')}
          className={`pb-2 px-1 text-sm font-medium transition-colors ${inventoryTab === 'entries' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Histórico de Entradas
        </button>
        <button
          onClick={() => setInventoryTab('returns')}
          className={`pb-2 px-1 text-sm font-medium transition-colors ${inventoryTab === 'returns' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Histórico de Devoluções
        </button>
      </div>

      {inventoryTab === 'stock' && (
        <div className="card">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Livro</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Autor</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-center">Recebidos</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-center">Vendidos</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-center">Devolvidos</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-center">Saldo Atual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inventory.map(item => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium">{item.title}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{item.author_name}</td>
                  <td className="px-6 py-4 text-sm text-center">{item.received}</td>
                  <td className="px-6 py-4 text-sm text-center text-emerald-600">{item.sold}</td>
                  <td className="px-6 py-4 text-sm text-center text-amber-600">{item.returned}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${item.stock > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-red-100 text-red-700'}`}>
                      {item.stock}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {inventoryTab === 'entries' && (
        <div className="card">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Data</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Livro</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Autor</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-center">Qtd</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Responsável</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {consignments.map(c => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm">{new Date(c.entry_date || c.date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 font-medium">{c.title}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{c.author_name}</td>
                  <td className="px-6 py-4 text-sm text-center font-bold">{c.quantity}</td>
                  <td className="px-6 py-4 text-sm">{c.responsible}</td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => {
                        setPrintData({ type: 'entry', ...c });
                        setTimeout(() => window.print(), 100);
                      }}
                      className="text-slate-400 hover:text-indigo-600"
                    >
                      <Printer size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {inventoryTab === 'returns' && (
        <div className="card">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Data</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Livro</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Autor</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-center">Qtd</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Motivo</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {returns.map(r => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm">{new Date(r.return_date || r.date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 font-medium">{r.title}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{r.author_name}</td>
                  <td className="px-6 py-4 text-sm text-center font-bold">{r.quantity}</td>
                  <td className="px-6 py-4 text-sm">{r.reason}</td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => {
                        setPrintData({ type: 'return', ...r });
                        setTimeout(() => window.print(), 100);
                      }}
                      className="text-slate-400 hover:text-indigo-600"
                    >
                      <Printer size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderSettlements = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Acertos de Consignação</h2>
        <div className="flex gap-3">
          <button onClick={() => exportToCSV(settlements, 'acertos')} className="btn-secondary flex items-center gap-2 text-sm">
            <Download size={16} /> Exportar
          </button>
          <button onClick={() => openModal('settlement')} className="btn-primary flex items-center gap-2">
            <Plus size={18} /> Novo Acerto
          </button>
        </div>
      </div>
      <div className="card">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600">Autor</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600">Período</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600">Repasse Total</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600">Status</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {settlements.map(s => (
              <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <p className="font-medium">{s.author_name}</p>
                  <p className="text-xs text-slate-400 font-mono">PIX: {s.pix_key}</p>
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">
                  {new Date(s.start_date).toLocaleDateString()} - {new Date(s.end_date).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 font-bold text-slate-800">R$ {s.total_repasse.toFixed(2)}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${s.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {s.status === 'paid' ? 'Pago' : 'Pendente'}
                  </span>
                </td>
                <td className="px-6 py-4 flex gap-2">
                  {s.status === 'pending' ? (
                    <button onClick={() => handlePaySettlement(s.id)} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-all" title="Marcar como Pago">
                      <CheckCircle2 size={18} />
                    </button>
                  ) : (
                    <button onClick={() => handleToggleSettlementStatus(s.id, s.status)} className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition-all" title="Desfazer Pagamento">
                      <Undo2 size={18} />
                    </button>
                  )}
                  <button
                    onClick={() => setEditingSettlement(s)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                    title="Editar Acerto"
                  >
                    <Pencil size={18} />
                  </button>
                  <button
                    onClick={() => {
                      setPrintData({ type: 'settlement', ...s });
                      setTimeout(() => window.print(), 100);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                    title="Imprimir Comprovante"
                  >
                    <Printer size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete('settlements', s.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
                    title="Excluir Acerto"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderFinancial = () => {
    const paidSettlements = settlements.filter(s => s.status === 'paid');
    const pendingSettlements = settlements.filter(s => s.status === 'pending');

    const totalPaid = paidSettlements.reduce((acc, s) => acc + s.total_repasse, 0);
    const totalPending = pendingSettlements.reduce((acc, s) => acc + s.total_repasse, 0);

    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <StatCard label="Total Pago" value={`R$ ${totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={CheckCircle2} color="bg-emerald-500" />
          <StatCard label="Total a Pagar" value={`R$ ${totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={Clock} color="bg-amber-500" />
        </div>

        <div className="card">
          <div className="p-6 border-b border-slate-100">
            <h3 className="font-bold text-slate-800">Controle de Pagamentos</h3>
          </div>
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Autor</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Valor</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Status</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Pagamento</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {settlements.map(s => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium">{s.author_name}</p>
                    <p className="text-xs text-slate-400">PIX: {s.pix_key}</p>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-800">R$ {Number(s.total_repasse || 0).toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${s.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {s.status === 'paid' ? 'Pago' : 'Pendente'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {s.status === 'paid' ? (
                      <div>
                        <p>{new Date(s.payment_date!).toLocaleDateString()}</p>
                        <p className="text-xs">{s.payment_method}</p>
                      </div>
                    ) : (
                      <span className="text-slate-300 italic">Aguardando</span>
                    )}
                  </td>
                  <td className="px-6 py-4 flex gap-2">
                    {s.status === 'pending' ? (
                      <button
                        onClick={() => handlePaySettlement(s.id)}
                        className="btn-primary text-xs py-1 px-3"
                      >
                        Pagar Agora
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleToggleSettlementStatus(s.id, s.status)}
                          className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition-all"
                          title="Desfazer Pagamento"
                        >
                          <Undo2 size={18} />
                        </button>
                        <button
                          onClick={() => {
                            setPrintData({ type: 'settlement', ...s });
                            setTimeout(() => window.print(), 100);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                          title="Imprimir"
                        >
                          <Printer size={18} />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setEditingSettlement(s)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                      title="Editar"
                    >
                      <Pencil size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete('settlements', s.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
                      title="Excluir"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const handleClearSales = async () => {
    if (!confirm("ATENÇÃO: Isso excluirá TODAS as vendas (autores e gerais) que ainda não foram incluídas em acertos. Deseja continuar?")) return;

    try {
      const res = await fetch('/api/sales/clear-unsettled', { method: 'DELETE' });
      if (res.ok) {
        alert("Histórico de vendas não processadas limpo com sucesso.");
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Erro ao limpar histórico.");
      }
    } catch (error) {
      alert("Erro de conexão.");
    }
  };

  const renderSalesHistory = () => (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Histórico de Vendas</h2>
        <div className="flex gap-3">
          <button onClick={handleClearSales} className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-100">
            Limpar Não Processadas
          </button>
          <button onClick={() => handleImportExcel('sales/unified-import')} className="btn-primary flex items-center gap-2 text-sm shadow-lg shadow-indigo-100">
            <FileText size={16} /> Importar Nova Planilha
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
            <BookOpen size={20} className="text-indigo-500" /> Vendas de Autores
          </h3>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Data</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Livro</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Qtd</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Valor</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allSales.map(sale => (
                    <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-sm">{new Date(sale.sale_date || sale.date).toLocaleDateString('pt-BR')}</td>
                      <td className="px-4 py-3 text-sm font-medium">
                        {sale.title}
                        <div className="text-[10px] text-slate-400">{sale.author_name}</div>
                      </td>
                      <td className="px-4 py-3 text-sm">{sale.quantity}</td>
                      <td className="px-4 py-3 text-sm font-mono">R$ {(sale.sale_price || sale.price || 0).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete('sales', sale.id);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
                          title="Excluir venda"
                          disabled={!!sale.settlement_id}
                        >
                          <Trash2 size={16} className={sale.settlement_id ? 'opacity-10' : ''} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {allSales.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">Nenhuma venda de autor registrada.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
            <DollarSign size={20} className="text-emerald-500" /> Vendas Gerais da Loja
          </h3>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Data</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Valor Total</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Notas</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allGeneralSales.map(sale => (
                    <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-sm">{new Date(sale.sale_date || sale.date).toLocaleDateString('pt-BR')}</td>
                      <td className="px-4 py-3 text-sm font-bold text-emerald-600 font-mono">R$ {sale.amount.toFixed(2)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 truncate max-w-[150px]">{sale.notes}</td>
                      <td className="px-4 py-3 flex gap-1">
                        <button
                          onClick={() => setEditingGeneralSale(sale)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                          title="Editar venda"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete('general-sales', sale.id);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
                          title="Excluir venda"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {allGeneralSales.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">Nenhuma venda geral registrada.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderEditModals = () => (
    <>
      <AnimatePresence>
        {editingSettlement && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="text-xl font-bold text-slate-800">Editar Acerto</h3>
                <button onClick={() => setEditingSettlement(null)} className="text-slate-400 hover:text-slate-600">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>
              <form onSubmit={handleUpdateSettlement} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Início</label>
                    <input
                      type="date"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={editingSettlement.start_date}
                      onChange={e => setEditingSettlement({ ...editingSettlement, start_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fim</label>
                    <input
                      type="date"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={editingSettlement.end_date}
                      onChange={e => setEditingSettlement({ ...editingSettlement, end_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Bruto (R$)</label>
                    <input
                      type="number" step="0.01"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={editingSettlement.total_gross}
                      onChange={e => setEditingSettlement({ ...editingSettlement, total_gross: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Repasse (R$)</label>
                    <input
                      type="number" step="0.01"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={editingSettlement.total_repasse}
                      onChange={e => setEditingSettlement({ ...editingSettlement, total_repasse: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                    <select
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={editingSettlement.status}
                      onChange={e => setEditingSettlement({ ...editingSettlement, status: e.target.value as any })}
                    >
                      <option value="pending">Pendente</option>
                      <option value="paid">Pago</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Pagto</label>
                    <input
                      type="date"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={editingSettlement.payment_date || ''}
                      onChange={e => setEditingSettlement({ ...editingSettlement, payment_date: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Forma de Pagto</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={editingSettlement.payment_method || ''}
                    onChange={e => setEditingSettlement({ ...editingSettlement, payment_method: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Observações</label>
                  <textarea
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={editingSettlement.notes || ''}
                    onChange={e => setEditingSettlement({ ...editingSettlement, notes: e.target.value })}
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setEditingSettlement(null)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 font-bold hover:bg-slate-50">Cancelar</button>
                  <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200">Salvar Alterações</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {editingGeneralSale && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="text-xl font-bold text-slate-800">Editar Venda Geral</h3>
                <button onClick={() => setEditingGeneralSale(null)} className="text-slate-400 hover:text-slate-600">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>
              <form onSubmit={handleUpdateGeneralSale} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data</label>
                  <input
                    type="date"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={editingGeneralSale.sale_date || editingGeneralSale.date}
                    onChange={e => setEditingGeneralSale({ ...editingGeneralSale, sale_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Valor (R$)</label>
                  <input
                    type="number" step="0.01"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={editingGeneralSale.amount}
                    onChange={e => setEditingGeneralSale({ ...editingGeneralSale, amount: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notas</label>
                  <textarea
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={editingGeneralSale.notes || ''}
                    onChange={e => setEditingGeneralSale({ ...editingGeneralSale, notes: e.target.value })}
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setEditingGeneralSale(null)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 font-bold hover:bg-slate-50">Cancelar</button>
                  <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200">Salvar</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50">Carregando...</div>;

  return (
    <div className="flex min-h-screen">
      {renderEditModals()}
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 p-6 flex flex-col gap-8 no-print">
        <div className="flex flex-col items-center gap-2 px-2 border-b border-slate-100 pb-6 mb-2">
          <img src="/logo.png" alt="Nobel Autores Locais" className="w-full h-auto rounded-lg shadow-sm" />
        </div>

        <nav className="flex flex-col gap-2">
          <SidebarItem icon={LayoutDashboard} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarItem icon={Users} label="Autores" active={activeTab === 'authors'} onClick={() => setActiveTab('authors')} />
          <SidebarItem icon={BookOpen} label="Livros" active={activeTab === 'books'} onClick={() => setActiveTab('books')} />
          <SidebarItem icon={PackagePlus} label="Estoque" active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} />
          <SidebarItem icon={FileText} label="Acertos" active={activeTab === 'settlements'} onClick={() => setActiveTab('settlements')} />
          <SidebarItem icon={ShoppingCart} label="Vendas" active={activeTab === 'sales_history'} onClick={() => setActiveTab('sales_history')} />
          <SidebarItem icon={Wallet} label="Financeiro" active={activeTab === 'financial'} onClick={() => setActiveTab('financial')} />
        </nav>

        <div className="mt-auto p-4 bg-slate-50 rounded-xl">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-2">Suporte</p>
          <button className="text-sm text-slate-600 hover:text-indigo-600 flex items-center gap-2">
            <AlertCircle size={14} /> Ajuda & FAQ
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'authors' && renderAuthors()}
            {activeTab === 'books' && renderBooks()}
            {activeTab === 'inventory' && renderInventory()}
            {activeTab === 'settlements' && renderSettlements()}
            {activeTab === 'sales_history' && renderSalesHistory()}
            {activeTab === 'financial' && renderFinancial()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Modals */}
      {showModal === 'author' && (
        <Modal title={formData.id ? "Editar Autor" : "Novo Autor"} onClose={() => setShowModal(null)} onSubmit={(e) => handleSubmit(e, 'authors')}>
          <input className="input-field" placeholder="Nome Completo" required value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <input className="input-field" placeholder="Telefone" value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
            <input className="input-field" placeholder="E-mail" type="email" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} />
          </div>
          <input className="input-field" placeholder="Chave PIX" value={formData.pix_key || ''} onChange={e => setFormData({ ...formData, pix_key: e.target.value })} />
          <textarea className="input-field" placeholder="Observações" rows={3} value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
        </Modal>
      )}

      {showModal === 'book' && (
        <Modal title={formData.id ? "Editar Livro" : "Novo Livro"} onClose={() => setShowModal(null)} onSubmit={(e) => handleSubmit(e, 'books')}>
          <input className="input-field" placeholder="Título do Livro" required value={formData.title || ''} onChange={e => setFormData({ ...formData, title: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <input className="input-field" placeholder="ISBN (opcional)" value={formData.isbn || ''} onChange={e => setFormData({ ...formData, isbn: e.target.value })} />
            <select className="input-field" required value={formData.author_id || ''} onChange={e => setFormData({ ...formData, author_id: e.target.value })}>
              <option value="">Selecionar Autor</option>
              {authors.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <input className="input-field" placeholder="Preço Capa" type="number" step="0.01" required value={formData.cover_price || ''} onChange={e => setFormData({ ...formData, cover_price: e.target.value })} />
            <select className="input-field" required value={formData.repasse_type || 'percent'} onChange={e => setFormData({ ...formData, repasse_type: e.target.value })}>
              <option value="percent">% Comissão</option>
              <option value="fixed">Valor Fixo</option>
            </select>
            <input className="input-field" placeholder="Valor" type="number" step="0.01" required value={formData.repasse_value || ''} onChange={e => setFormData({ ...formData, repasse_value: e.target.value })} />
          </div>
          <input className="input-field" placeholder="Categoria" value={formData.category || ''} onChange={e => setFormData({ ...formData, category: e.target.value })} />
        </Modal>
      )}

      {showModal === 'consignment' && (
        <Modal title="Entrada de Lote" onClose={() => setShowModal(null)} onSubmit={(e) => handleSubmit(e, 'consignments')}>
          <select className="input-field" required value={formData.book_id || ''} onChange={e => setFormData({ ...formData, book_id: e.target.value })}>
            <option value="">Selecionar Livro</option>
            {books.map(b => <option key={b.id} value={b.id}>{b.title} ({b.author_name})</option>)}
          </select>
          <div className="grid grid-cols-2 gap-4">
            <input className="input-field" placeholder="Quantidade" type="number" required value={formData.quantity || ''} onChange={e => setFormData({ ...formData, quantity: e.target.value })} />
            <input className="input-field" type="date" required value={formData.entry_date || ''} onChange={e => setFormData({ ...formData, entry_date: e.target.value })} />
          </div>
          <input className="input-field" placeholder="Responsável" required value={formData.responsible || ''} onChange={e => setFormData({ ...formData, responsible: e.target.value })} />
          <textarea className="input-field" placeholder="Notas do Termo" rows={2} value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
        </Modal>
      )}

      {showModal === 'sale' && (
        <Modal title="Lançar Venda" onClose={() => setShowModal(null)} onSubmit={(e) => handleSubmit(e, 'sales')}>
          <select className="input-field" required value={formData.book_id || ''} onChange={e => {
            const book = books.find(b => b.id === parseInt(e.target.value));
            setFormData({ ...formData, book_id: e.target.value, sale_price: book?.cover_price })
          }}>
            <option value="">Selecionar Livro</option>
            {books.map(b => <option key={b.id} value={b.id}>{b.title} - R$ {b.cover_price?.toFixed(2)}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-4">
            <input className="input-field" placeholder="Qtd" type="number" required value={formData.quantity || ''} onChange={e => setFormData({ ...formData, quantity: e.target.value })} />
            <input className="input-field" placeholder="Preço Real" type="number" step="0.01" value={formData.sale_price || ''} onChange={e => setFormData({ ...formData, sale_price: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <select className="input-field" value={formData.channel || 'loja'} onChange={e => setFormData({ ...formData, channel: e.target.value })}>
              <option value="loja">Loja Física</option>
              <option value="online">Online</option>
              <option value="feira">Feira/Evento</option>
            </select>
            <input className="input-field" type="date" required value={formData.sale_date || ''} onChange={e => setFormData({ ...formData, sale_date: e.target.value })} />
          </div>
          <input className="input-field" placeholder="Ref. Pedido / Responsável" value={formData.responsible || ''} onChange={e => setFormData({ ...formData, responsible: e.target.value })} />
        </Modal>
      )}

      {showModal === 'return' && (
        <Modal title="Registrar Devolução" onClose={() => setShowModal(null)} onSubmit={(e) => handleSubmit(e, 'returns')}>
          <select className="input-field" required value={formData.book_id || ''} onChange={e => setFormData({ ...formData, book_id: e.target.value })}>
            <option value="">Selecionar Livro</option>
            {books.map(b => <option key={b.id} value={b.id}>{b.title} ({b.author_name})</option>)}
          </select>
          <div className="grid grid-cols-2 gap-4">
            <input className="input-field" placeholder="Qtd" type="number" required value={formData.quantity || ''} onChange={e => setFormData({ ...formData, quantity: e.target.value })} />
            <input className="input-field" type="date" required value={formData.return_date || ''} onChange={e => setFormData({ ...formData, return_date: e.target.value })} />
          </div>
          <input className="input-field" placeholder="Motivo" required value={formData.reason || ''} onChange={e => setFormData({ ...formData, reason: e.target.value })} />
        </Modal>
      )}

      {showModal === 'settlement' && (
        <Modal title="Gerar Acerto" onClose={() => setShowModal(null)} onSubmit={(e) => handleSubmit(e, 'settlements')}>
          <select className="input-field" required value={formData.author_id || ''} onChange={e => setFormData({ ...formData, author_id: e.target.value })}>
            <option value="">Selecionar Autor</option>
            {authors.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400">Início</label>
              <input className="input-field" type="date" required value={formData.start_date || ''} onChange={e => setFormData({ ...formData, start_date: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400">Fim</label>
              <input className="input-field" type="date" required value={formData.end_date || ''} onChange={e => setFormData({ ...formData, end_date: e.target.value })} />
            </div>
          </div>
          <button type="button" onClick={fetchSettlementPreview} className="w-full py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-bold transition-colors">
            Calcular Vendas
          </button>

          {settlementPreview && (
            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Vendas no período:</span>
                <span className="font-bold">{settlementPreview.items.length} itens</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Valor Bruto:</span>
                <span className="font-bold">R$ {settlementPreview.totalGross?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg text-indigo-700 pt-2 border-t border-indigo-200">
                <span className="font-bold">Total Repasse:</span>
                <span className="font-black">R$ {settlementPreview.totalRepasse?.toFixed(2)}</span>
              </div>
            </div>
          )}
        </Modal>
      )}

      {showModal === 'general_sale' && (
        <Modal title="Lançar Venda Geral da Loja" onClose={() => setShowModal(null)} onSubmit={(e) => handleSubmit(e, 'general-sales')}>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400">Valor Total das Vendas (R$)</label>
              <input className="input-field" type="number" step="0.01" required placeholder="0,00" value={formData.amount || ''} onChange={e => setFormData({ ...formData, amount: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400">Data</label>
              <input className="input-field" type="date" required value={formData.sale_date || ''} onChange={e => setFormData({ ...formData, sale_date: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400">Observações</label>
              <textarea className="input-field" placeholder="Ex: Vendas do sábado, feira externa, etc." rows={2} value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
            </div>
          </div>
        </Modal>
      )}

      {/* Print View (Hidden in UI) */}
      <div className="print-only p-10">
        {printData?.type === 'entry' && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold border-b-2 border-slate-900 pb-2">Comprovante de Recebimento</h1>
            <div className="grid grid-cols-2 gap-4">
              <p><strong>Autor:</strong> {printData.author_name}</p>
              <p><strong>Data:</strong> {new Date(printData.entry_date).toLocaleDateString()}</p>
              <p><strong>Livro:</strong> {printData.title}</p>
              <p><strong>Quantidade:</strong> {printData.quantity} un.</p>
              <p><strong>Responsável:</strong> {printData.responsible}</p>
            </div>
            {printData.notes && <p><strong>Observações:</strong> {printData.notes}</p>}
            <div className="mt-20 flex justify-between">
              <div className="border-t border-slate-900 w-64 pt-2 text-center">Assinatura Livraria</div>
              <div className="border-t border-slate-900 w-64 pt-2 text-center">Assinatura Autor</div>
            </div>
          </div>
        )}

        {printData?.type === 'return' && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold border-b-2 border-slate-900 pb-2">Comprovante de Devolução</h1>
            <div className="grid grid-cols-2 gap-4">
              <p><strong>Autor:</strong> {printData.author_name}</p>
              <p><strong>Data:</strong> {new Date(printData.return_date).toLocaleDateString()}</p>
              <p><strong>Livro:</strong> {printData.title}</p>
              <p><strong>Quantidade:</strong> {printData.quantity} un.</p>
              <p><strong>Motivo:</strong> {printData.reason}</p>
            </div>
            <div className="mt-20 flex justify-between">
              <div className="border-t border-slate-900 w-64 pt-2 text-center">Assinatura Livraria</div>
              <div className="border-t border-slate-900 w-64 pt-2 text-center">Assinatura Autor</div>
            </div>
          </div>
        )}

        {printData?.type === 'settlement' && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold border-b-2 border-slate-900 pb-2">Comprovante de Acerto</h1>
            <div className="grid grid-cols-2 gap-4">
              <p><strong>Autor:</strong> {printData.author_name}</p>
              <p><strong>Período:</strong> {new Date(printData.start_date).toLocaleDateString()} - {new Date(printData.end_date).toLocaleDateString()}</p>
              <p><strong>Total Repasse:</strong> R$ {printData.total_repasse.toFixed(2)}</p>
              <p><strong>Status:</strong> {printData.status === 'paid' ? 'PAGO' : 'PENDENTE'}</p>
            </div>
            <div className="mt-20 flex justify-between">
              <div className="border-t border-slate-900 w-64 pt-2 text-center">Assinatura Livraria</div>
              <div className="border-t border-slate-900 w-64 pt-2 text-center">Assinatura Autor</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
