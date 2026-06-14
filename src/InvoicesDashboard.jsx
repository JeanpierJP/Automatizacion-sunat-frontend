import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Toaster, toast } from 'sonner';
import {
  ArrowDownTrayIcon,
  CloudArrowUpIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  PencilSquareIcon,
  CheckIcon,
  XMarkIcon,
  BoltIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import api from './api';
import './InvoicesDashboard.css';

const TIPO_LABEL = { '01': 'Factura', '03': 'Boleta', '07': 'N. Crédito', '08': 'N. Débito' };
const TIPO_COLOR = { '01': 'badge-factura', '03': 'badge-boleta', '07': 'badge-nc', '08': 'badge-nd' };

function InvoicesDashboard() {
  const [records, setRecords]           = useState([]);
  const [loading, setLoading]           = useState(false);
  const [searchTerm, setSearch]         = useState('');
  const [uploading, setUploading]       = useState(false);
  const [runningSunat, setRunningSunat] = useState(false);
  const [editingId, setEditingId]       = useState(null);
  const [editForm, setEditForm]         = useState({});
  const [sunatRecords, setSunatRecords] = useState([]);
  const [lastRunErrors, setLastRunErrors] = useState(null);
  const [sunatLog, setSunatLog] = useState([]);
  const [sunatProgress, setSunatProgress] = useState({ current: 0, total: 0 });
  const fileRef = useRef(null);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/invoices');
      setRecords(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Error al conectar con la base de datos');
    } finally {
      setLoading(false);
    }
  };

  const fetchSunatRecords = async () => {
    try {
      const { data } = await api.get('/sunat-comprobantes');
      setSunatRecords(Array.isArray(data) ? data : []);
    } catch {
      // silencioso — no interrumpir carga principal
    }
  };

  useEffect(() => { fetchInvoices(); fetchSunatRecords(); }, []);

  const clearInvoices = async () => {
    if (!window.confirm('¿Eliminar todos los registros de Extracciones? Esta acción no se puede deshacer.')) return;
    try {
      await api.delete('/invoices');
      toast.success('Extracciones eliminadas');
      fetchInvoices();
    } catch {
      toast.error('Error al limpiar la tabla');
    }
  };

  const runSunat = (intento = 1) => {
    if (runningSunat && intento === 1) return;
    setRunningSunat(true);
    if (intento === 1) { setSunatLog([]); setSunatProgress({ current: 0, total: 0 }); }
    const tid = intento === 1
      ? toast.loading('Conectando con SUNAT…')
      : toast.loading(`Reintentando… (intento ${intento}/3)`);
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const es = new EventSource(`${API_URL}/run-sunat-stream`);
    let recibioEvento = false;

    const timeout = setTimeout(() => {
      if (!recibioEvento) {
        es.close();
        if (intento < 3) {
          toast.dismiss(tid);
          runSunat(intento + 1);
        } else {
          setRunningSunat(false);
          toast.error('SUNAT no respondió después de 3 intentos', { id: tid });
        }
      }
    }, 30000);

    es.onmessage = (e) => {
      recibioEvento = true;
      clearTimeout(timeout);
      const data = JSON.parse(e.data);
      if (data.type === 'start') {
        setSunatProgress({ current: 0, total: data.total });
        toast.loading(`Procesando ${data.total} comprobantes…`, { id: tid });
      } else if (data.type === 'progress') {
        setSunatProgress({ current: data.current, total: data.total });
        setSunatLog(prev => [...prev, data]);
      } else if (data.type === 'done') {
        es.close();
        setRunningSunat(false);
        setLastRunErrors(data.errores || 0);
        toast.success(
          `✓ ${data.guardados} comprobante(s) guardados en Drive` +
          (data.errores > 0 ? ` · ${data.errores} con error` : ''),
          { id: tid, duration: 7000 }
        );
        fetchInvoices();
        fetchSunatRecords();
      } else if (data.error || data.type === 'error') {
        es.close();
        clearTimeout(timeout);
        if (intento < 3) {
          toast.dismiss(tid);
          setTimeout(() => runSunat(intento + 1), 3000);
        } else {
          setRunningSunat(false);
          toast.error(data.error || data.msg || 'Error al ejecutar SUNAT', { id: tid });
        }
      }
    };

    es.onerror = () => {
      es.close();
      clearTimeout(timeout);
      if (intento < 3) {
        toast.dismiss(tid);
        setTimeout(() => runSunat(intento + 1), 3000);
      } else {
        setRunningSunat(false);
        toast.error('Error al ejecutar SUNAT después de 3 intentos', { id: tid });
      }
    };
  };

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    const tid = toast.loading(`Procesando ${files.length} archivo(s)…`);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        await api.post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      toast.success('Archivos procesados correctamente', { id: tid });
      fetchInvoices();
    } catch {
      toast.error('Error al procesar los archivos', { id: tid });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return records.filter(r =>
      (r.ruc || '').includes(q) ||
      (r.serie || '').toLowerCase().includes(q) ||
      (r.numero_comprobante || '').includes(q) ||
      (TIPO_LABEL[r.tipo_comprobante] || '').toLowerCase().includes(q)
    );
  }, [records, searchTerm]);

  const stats = useMemo(() => ({
    total:    records.length,
    facturas: records.filter(r => r.tipo_comprobante === '01').length,
    boletas:  records.filter(r => r.tipo_comprobante === '03').length,
  }), [records]);

  const sunatStats = useMemo(() => ({
    total:   sunatRecords.length,
    pdfs:    sunatRecords.filter(r => r.drive_pdf_url).length,
    xmls:    sunatRecords.filter(r => r.drive_xml_url).length,
    errores: lastRunErrors,
    fecha:   sunatRecords[0]?.created_at
      ? new Date(sunatRecords[0].created_at).toLocaleDateString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric' })
      : null,
  }), [sunatRecords, lastRunErrors]);

  const startEdit  = (inv) => { setEditingId(inv.id); setEditForm({ ...inv }); };
  const cancelEdit = ()    => { setEditingId(null); setEditForm({}); };
  const onField    = (f,v) => setEditForm(p => ({ ...p, [f]: v }));

  const saveEdit = async () => {
    try {
      await api.put(`/invoices/${editingId}`, {
        ruc: editForm.ruc,
        tipo_comprobante: editForm.tipo_comprobante,
        serie: editForm.serie,
        numero_comprobante: editForm.numero_comprobante,
      });
      toast.success('Cambios guardados');
      cancelEdit();
      fetchInvoices();
    } catch {
      toast.error('No se pudo actualizar');
    }
  };

  const exportExcel = () => {
    const rows = filtered.map(r => ({
      'RUC Emisor':      r.ruc,
      'Tipo':            TIPO_LABEL[r.tipo_comprobante] || r.tipo_comprobante,
      'Serie':           r.serie,
      'N° Comprobante':  r.numero_comprobante,
      'Archivo':         r.file_url,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Comprobantes');
    XLSX.writeFile(wb, 'Comprobantes_SUNAT.xlsx');
  };

  return (
    <div className="dashboard-container">
      <Toaster position="top-right" richColors />

      {/* ── Header ── */}
      <div className="header">
        <div className="header-brand">
          <h1 className="dashboard-title">
            Comprob<span className="title-accent">Auto</span>
            <span className="title-tag">SUNAT</span>
          </h1>
          <p className="dashboard-subtitle">Registro automatizado de comprobantes electrónicos</p>
        </div>

        <div className="header-actions">
          <button className="btn btn-ghost" onClick={fetchInvoices} title="Actualizar">
            <ArrowPathIcon style={{ width: 16, height: 16, flexShrink: 0, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>

          <button
            className="btn btn-sunat"
            onClick={runSunat}
            disabled={runningSunat}
            title="Descargar comprobantes del Excel desde SUNAT"
          >
            <BoltIcon style={{ width: 16, height: 16, flexShrink: 0, animation: runningSunat ? 'spin 1s linear infinite' : 'none' }} />
            {runningSunat ? 'Ejecutando…' : 'Ejecutar SUNAT'}
          </button>

          <button
            className="btn btn-upload"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            <CloudArrowUpIcon style={{ width: 16, height: 16, flexShrink: 0 }} />
            {uploading ? 'Procesando…' : 'Subir Comprobantes'}
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".xlsx,.txt,.pdf,.jpg,.jpeg,.png"
            style={{ display: 'none' }}
            onChange={handleUpload}
          />

          <button className="btn btn-excel" onClick={exportExcel}>
            <ArrowDownTrayIcon style={{ width: 16, height: 16, flexShrink: 0 }} />
            Exportar Excel
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="stats-grid">
        <div className="stat-card stat-card-total">
          <div className="stat-label">Total Comprobantes</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-card stat-card-factura">
          <div className="stat-label">Facturas</div>
          <div className="stat-value green">{stats.facturas}</div>
        </div>
        <div className="stat-card stat-card-boleta">
          <div className="stat-label">Boletas</div>
          <div className="stat-value blue">{stats.boletas}</div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="table-card">
        <div className="table-toolbar">
          <div className="search-wrap">
            <MagnifyingGlassIcon style={{ width: 14, height: 14 }} />
            <input
              type="text"
              className="search-input"
              placeholder="Buscar por RUC, Serie, N° o Tipo…"
              value={searchTerm}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button className="btn btn-clear" onClick={clearInvoices} title="Eliminar todas las extracciones">
              <TrashIcon style={{ width: 14, height: 14, flexShrink: 0 }} />
              Limpiar
            </button>
          <span className="record-count">{filtered.length} / {records.length} registros</span>
        </div>

        <div className="table-wrapper">
          <table className="comp-table">
            <thead>
              <tr>
                <th>RUC Emisor</th>
                <th>Tipo</th>
                <th>Serie</th>
                <th>N° Comprobante</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(inv => (
                <tr key={inv.id}>
                  {/* RUC */}
                  <td className="cell-ruc">
                    {editingId === inv.id
                      ? <input className="edit-input" value={editForm.ruc || ''} onChange={e => onField('ruc', e.target.value)} />
                      : inv.ruc || '—'}
                  </td>

                  {/* Tipo */}
                  <td>
                    {editingId === inv.id
                      ? (
                        <select className="edit-input" value={editForm.tipo_comprobante || ''} onChange={e => onField('tipo_comprobante', e.target.value)}>
                          <option value="01">Factura</option>
                          <option value="03">Boleta</option>
                          <option value="07">N. Crédito</option>
                          <option value="08">N. Débito</option>
                        </select>
                      ) : (
                        <span className={`badge ${TIPO_COLOR[inv.tipo_comprobante] || 'badge-default'}`}>
                          {TIPO_LABEL[inv.tipo_comprobante] || '—'}
                        </span>
                      )}
                  </td>

                  {/* Serie */}
                  <td className="cell-serie">
                    {editingId === inv.id
                      ? <input className="edit-input" value={editForm.serie || ''} onChange={e => onField('serie', e.target.value)} />
                      : inv.serie || '—'}
                  </td>

                  {/* N° Comprobante */}
                  <td className="cell-numero">
                    {editingId === inv.id
                      ? <input className="edit-input" value={editForm.numero_comprobante || ''} onChange={e => onField('numero_comprobante', e.target.value)} />
                      : inv.numero_comprobante || '—'}
                  </td>

                  {/* Acciones */}
                  <td>
                    <div className="actions-cell">
                      {editingId === inv.id ? (
                        <>
                          <button className="btn-action" style={{ color: '#34d399' }} onClick={saveEdit}><CheckIcon style={{ width: 15, height: 15 }} /></button>
                          <button className="btn-action" style={{ color: '#f87171' }} onClick={cancelEdit}><XMarkIcon style={{ width: 15, height: 15 }} /></button>
                        </>
                      ) : (
                        <button className="btn-action" style={{ color: '#334155' }} onClick={() => startEdit(inv)}><PencilSquareIcon style={{ width: 15, height: 15 }} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && !loading && (
                <tr><td colSpan="5" className="empty-state">No hay comprobantes. Sube archivos para comenzar.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* ── Panel progreso SUNAT en vivo ── */}
      {runningSunat && sunatProgress.total > 0 && (
        <div className="sunat-progress-card">
          <div className="sunat-progress-header">
            <BoltIcon style={{ width: 15, height: 15, animation: 'spin 1s linear infinite' }} />
            <span>Ejecutando SUNAT — {sunatProgress.current} / {sunatProgress.total}</span>
          </div>
          <div className="sunat-progress-bar-wrap">
            <div className="sunat-progress-bar" style={{ width: `${(sunatProgress.current / sunatProgress.total) * 100}%` }} />
          </div>
          <div className="sunat-log">
            {sunatLog.slice(-8).map((item, i) => (
              <div key={i} className={`sunat-log-item sunat-log-${item.status}`}>
                <span>{item.status === 'ok' ? '✓' : '✗'}</span>
                <span>{item.serie}-{item.numero}
                  {item.status === 'ok' && ` · ${item.pdf ? 'PDF' : ''}${item.pdf && item.xml ? '+' : ''}${item.xml ? 'XML' : ''}`}
                  {item.status === 'error' && ` · ${item.msg}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Panel resumen SUNAT ── */}
      {sunatStats.total > 0 && (
        <div className="sunat-summary-card">
          <div className="sunat-summary-header">
            <BoltIcon style={{ width: 15, height: 15 }} />
            <span>Última ejecución SUNAT</span>
            {sunatStats.fecha && <span className="sunat-fecha">{sunatStats.fecha}</span>}
          </div>
          <div className="sunat-summary-stats">
            <div className="sunat-stat">
              <span className="sunat-stat-value">{sunatStats.total}</span>
              <span className="sunat-stat-label">Procesados</span>
            </div>
            <div className="sunat-stat-divider" />
            <div className="sunat-stat">
              <span className="sunat-stat-value sunat-pdf">{sunatStats.pdfs}</span>
              <span className="sunat-stat-label">PDFs en Drive</span>
            </div>
            <div className="sunat-stat-divider" />
            <div className="sunat-stat">
              <span className="sunat-stat-value sunat-xml">{sunatStats.xmls}</span>
              <span className="sunat-stat-label">XMLs en Drive</span>
            </div>
            {sunatStats.errores > 0 && (
              <>
                <div className="sunat-stat-divider" />
                <div className="sunat-stat">
                  <span className="sunat-stat-value sunat-err">{sunatStats.errores}</span>
                  <span className="sunat-stat-label">Con error</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default InvoicesDashboard;
