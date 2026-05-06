import { useState, useEffect } from 'react'
import { supabase, getLocalDate } from '../supabaseClient'
import GlobalLoader from '../components/GlobalLoader'
import { Package, AlertTriangle, CalendarClock, Users, Activity, BarChart3, PieChart as PieChartIcon, TrendingUp } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, AreaChart, Area
} from 'recharts'

// ── Paleta de colores para gráficas ──
const CHART_COLORS = [
  '#f97316', '#fb923c', '#fdba74', '#fed7aa', '#ffedd5',
  '#ea580c', '#c2410c', '#9a3412', '#7c2d12', '#431407'
]

// ── Color por estado lógico (PieChart) ──
const STOCK_COLOR_MAP = {
  'Stock Óptimo': '#10b981',
  'Stock Bajo':   '#f59e0b',
  'Sin Stock':    '#ef4444',
}

function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalProducts: 0,
    lowStock: 0,
    expiringSoon: 0,
    todayAttendance: 0
  })
  const [recentActivity, setRecentActivity] = useState([])
  const [categoryData, setCategoryData] = useState([])
  const [stockDistribution, setStockDistribution] = useState([])
  const [attendanceData, setAttendanceData] = useState([])

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      // Total productos activos
      const { count: totalProducts } = await supabase
        .from('product')
        .select('*', { count: 'exact', head: true })
        .eq('is_archived', false)

      // Productos con stock bajo (< 10 y > 0)
      const { count: lowStock } = await supabase
        .from('product')
        .select('*', { count: 'exact', head: true })
        .eq('is_archived', false)
        .lt('stock', 10)
        .gt('stock', 0)

      // Productos agotados (stock = 0)
      const { count: outOfStock } = await supabase
        .from('product')
        .select('*', { count: 'exact', head: true })
        .eq('is_archived', false)
        .eq('stock', 0)

      // Lotes próximos a vencer (30 días)
      const { data: lotesVencer } = await supabase.rpc('get_lotes_por_vencer', { p_dias: 30 })
      const expiringSoon = lotesVencer?.length || 0

      // Asistencia de hoy
      const today = getLocalDate()
      const { data: todayData, error: attendanceError } = await supabase
        .from('asistencia_diaria')
        .select('total_alumnos')
        .eq('fecha', today)
        .maybeSingle()

      if (attendanceError && attendanceError.code !== 'PGRST116') {
        console.error('Error cargando asistencia:', attendanceError)
      }

      // ── Rubros por categoría (BarChart) ──
      const { data: productsWithCat } = await supabase
        .from('product')
        .select('id_product, category(category_name)')
        .eq('is_archived', false)

      const catCounts = {}
      ;(productsWithCat || []).forEach(p => {
        const name = p.category?.category_name || 'Sin categoría'
        catCounts[name] = (catCounts[name] || 0) + 1
      })
      const catChartData = Object.entries(catCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)

      // ── Distribución de stock (PieChart) ──
      const optimalStock = (totalProducts || 0) - (lowStock || 0) - (outOfStock || 0)
      const pieData = [
        { name: 'Stock Óptimo', value: optimalStock > 0 ? optimalStock : 0 },
        { name: 'Stock Bajo', value: lowStock || 0 },
        { name: 'Sin Stock', value: outOfStock || 0 },
      ].filter(d => d.value > 0)

      // ── Tendencia de asistencia (últimos 7 días) ──
      const { data: attendanceRows } = await supabase
        .from('asistencia_diaria')
        .select('fecha, total_alumnos')
        .order('fecha', { ascending: false })
        .limit(7)

      const attendanceChart = (attendanceRows || [])
        .reverse()
        .map(r => ({
          fecha: new Date(r.fecha + 'T00:00:00').toLocaleDateString('es-VE', { weekday: 'short', day: '2-digit' }),
          alumnos: r.total_alumnos
        }))

      // ── Actividad reciente (últimos 8) ──
      const { data: activity } = await supabase
        .from('audit_log')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(8)

      let activityWithUsers = activity || []
      if (activity && activity.length > 0) {
        const userIds = [...new Set(activity.map(log => log.id_user).filter(Boolean))]

        if (userIds.length > 0) {
          const { data: usersData } = await supabase
            .from('users')
            .select('id_user, username')
            .in('id_user', userIds)

          const usersMap = {}
          usersData?.forEach(user => { usersMap[user.id_user] = user })

          activityWithUsers = activity.map(log => ({
            ...log,
            users: usersMap[log.id_user] || null
          }))
        }
      }

      setStats({
        totalProducts: totalProducts || 0,
        lowStock: (lowStock || 0) + (outOfStock || 0),
        expiringSoon,
        todayAttendance: todayData?.total_alumnos || 0
      })
      setCategoryData(catChartData)
      setStockDistribution(pieData)
      setAttendanceData(attendanceChart)
      setRecentActivity(activityWithUsers)
    } catch (error) {
      console.error('Error cargando dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <GlobalLoader text="Consultando la base de datos..." />

  // ── Stat Card component ──
  const StatCard = ({ icon: Icon, label, value, subtitle, color, bgClass }) => (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-start gap-4 transition-shadow hover:shadow-md">
      <div className={`p-3 rounded-xl ${bgClass}`}>
        <Icon className="w-6 h-6" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-500 font-medium">{label}</p>
        <p className="text-2xl font-heading font-bold mt-0.5" style={{ color }}>{value}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-1 truncate">{subtitle}</p>}
      </div>
    </div>
  )

  // ── Custom Tooltip for BarChart ──
  const BarTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-white border border-gray-200 shadow-lg rounded-lg px-3 py-2 text-sm">
        <p className="font-semibold text-slate-700">{payload[0].payload.name}</p>
        <p className="text-orange-600">{payload[0].value} {payload[0].value === 1 ? 'rubro' : 'rubros'}</p>
      </div>
    )
  }

  // ── Custom Tooltip for PieChart ──
  const PieTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-white border border-gray-200 shadow-lg rounded-lg px-3 py-2 text-sm">
        <p className="font-semibold text-slate-700">{payload[0].name}</p>
        <p style={{ color: payload[0].payload.fill }}>{payload[0].value} rubros</p>
      </div>
    )
  }

  // ── Action badge map ──
  const actionLabel = (type) => {
    const map = {
      INSERT: { text: 'CREAR', cls: 'badge-success' },
      UPDATE: { text: 'EDITAR', cls: 'badge-warning' },
      APPROVE: { text: 'APROBAR', cls: 'badge-success' },
      REJECT: { text: 'RECHAZAR', cls: 'badge-danger' },
      DELETE: { text: 'ELIMINAR', cls: 'badge-danger' },
      ANNUL: { text: 'ANULAR', cls: 'badge-danger' },
    }
    return map[type] || { text: type, cls: 'badge-danger' }
  }

  return (
    <div className="space-y-6">
      {/* ── Título ── */}
      <div>
        <h2 className="text-2xl font-heading font-bold text-slate-800">Panel de Control</h2>
        <p className="text-sm text-slate-400 mt-1">Resumen operativo del comedor escolar</p>
      </div>

      {/* ── Tarjetas de KPI ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={Package} label="Total Rubros" value={stats.totalProducts}
          subtitle="Rubros activos en inventario"
          color="#3b82f6" bgClass="bg-blue-50"
        />
        <StatCard
          icon={AlertTriangle} label="Atención Requerida" value={stats.lowStock}
          subtitle="Stock bajo o agotado"
          color="#f59e0b" bgClass="bg-amber-50"
        />
        <StatCard
          icon={CalendarClock} label="Lotes por Vencer" value={stats.expiringSoon}
          subtitle="Vencen en los próximos 30 días"
          color="#ef4444" bgClass="bg-red-50"
        />
        <StatCard
          icon={Users} label="Asistencia Hoy" value={stats.todayAttendance}
          subtitle={stats.todayAttendance === 0 ? 'Sin registro' : 'Comensales presentes'}
          color="#22c55e" bgClass="bg-emerald-50"
        />
      </div>

      {/* ── Tendencia de Asistencia (full-width) ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-blue-500" />
          <h3 className="text-base font-semibold text-slate-700">Tendencia de Asistencia</h3>
          <span className="text-xs text-slate-400 ml-auto">Últimos 7 días</span>
        </div>
        {attendanceData.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-12">Sin registros de asistencia</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={attendanceData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
              <defs>
                <linearGradient id="gradientAsistencia" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                formatter={(value) => [`${value} comensales`, 'Asistencia']}
              />
              <Area
                type="monotone"
                dataKey="alumnos"
                stroke="#3b82f6"
                strokeWidth={2.5}
                fill="url(#gradientAsistencia)"
                dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Gráficas: Barras + Donut ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* BarChart: Rubros por categoría */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-orange-500" />
            <h3 className="text-base font-semibold text-slate-700">Rubros por Categoría</h3>
          </div>
          {categoryData.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-12">Sin datos de categorías</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={categoryData} margin={{ top: 5, right: 10, left: -10, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                  height={60}
                />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                <Tooltip content={<BarTooltip />} cursor={{ fill: '#fff7ed' }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={40}>
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* PieChart / Donut: Distribución de stock */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <PieChartIcon className="w-5 h-5 text-emerald-500" />
            <h3 className="text-base font-semibold text-slate-700">Estado del Inventario</h3>
          </div>
          {stockDistribution.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-12">Sin datos de inventario</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={stockDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {stockDistribution.map((entry, i) => (
                    <Cell key={i} fill={STOCK_COLOR_MAP[entry.name] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={10}
                  formatter={(value) => <span className="text-sm text-slate-600">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Actividad Reciente ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-slate-400" />
          <h3 className="text-base font-semibold text-slate-700">Actividad Reciente</h3>
        </div>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">No hay actividad reciente</p>
        ) : (
          <div className="space-y-2">
            {recentActivity.map((log) => {
              const { text, cls } = actionLabel(log.action_type)
              return (
                <div
                  key={log.id_log}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 font-medium truncate">
                      {log.users?.username || 'Desconocido'}
                      <span className="text-slate-400 font-normal"> en </span>
                      <span className="text-slate-500">{log.table_affected}</span>
                    </p>
                  </div>
                  <span className={`badge ${cls} text-xs flex-shrink-0`}>{text}</span>
                  <span className="text-xs text-slate-400 flex-shrink-0 w-36 text-right">
                    {new Date(log.timestamp).toLocaleString('es-VE', {
                      day: '2-digit', month: '2-digit', year: '2-digit',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard