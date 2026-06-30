import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Equipment, EquipmentStatus as EqStatus, EquipmentType, MaintenanceDetails, Tank, User, UserRole } from '../types';
import { EQUIPMENT } from '../constants';
import { 
  Truck, 
  Calendar,
  Settings, 
  AlertCircle, 
  CheckCircle2, 
  Wrench, 
  Fuel, 
  Send,
  ArrowUpRight,
  Database,
  Search,
  Filter,
  ChevronRight,
  ChevronDown,
  FileText,
  Download,
  X,
  Edit2,
  Droplet,
  Layers
} from 'lucide-react';
import { useOperationalData } from '../context/OperationalDataContext';
import { useNotification } from '../context/NotificationContext';
import { supabaseService } from '../services/supabaseService';

interface EquipmentStatusProps {
  user: User;
}

export const EquipmentStatus: React.FC<EquipmentStatusProps> = ({ user }) => {
  const { notify } = useNotification();
  const { equipment, updateEquipmentStatus, updateEquipment, createAlert, alerts } = useOperationalData();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingMaintEq, setEditingMaintEq] = useState<Equipment | null>(null);
  const [editingVolumeEqId, setEditingVolumeEqId] = useState<string | null>(null);
  const [tempVolumeVal, setTempVolumeVal] = useState<string>('');
  
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const tooltipTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const triggerTooltip = (tabKey: string) => {
    setActiveTooltip(tabKey);
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    tooltipTimeoutRef.current = setTimeout(() => {
      setActiveTooltip(null);
    }, 2000);
  };

  useEffect(() => {
    if (editingMaintEq) {
      document.documentElement.classList.add('modal-open');
    } else {
      document.documentElement.classList.remove('modal-open');
    }
    return () => {
      document.documentElement.classList.remove('modal-open');
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, [editingMaintEq]);

  // Form state for maintenance modal
  const [maintForm, setMaintForm] = useState<MaintenanceDetails>({
    jobType: 'MAINTENANCE',
    description: '',
    actionRequiredBy: 'FUEL',
    breakdownDate: new Date().toISOString().split('T')[0],
    expectedReturnDate: ''
  });
  const [filterType, setFilterType] = useState<EquipmentType | 'All'>('All');
  const [pendingRequests, setPendingRequests] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    [EquipmentType.REFUELLER]: true,
    [EquipmentType.HYDRANT_DISPENSER]: true,
    [EquipmentType.DIESEL_TRUCK]: true,
    [EquipmentType.HYDRANT_SERVICE]: true,
  });

  const canEdit = user.role === UserRole.ADMIN || user.role === UserRole.ITP_MANAGER || user.role === UserRole.DEPOT_MANAGER;
  const isItpStaff = user ? [UserRole.ITP_MANAGER, UserRole.ITP_SUPERVISOR, UserRole.ITP_OFFICER, UserRole.ITP_OPERATOR, UserRole.ITP_HD_OPERATOR].includes(user.role) : false;

  const handleStatusChange = (id: string, newStatus: EqStatus) => {
    if (newStatus === EqStatus.AVAILABLE || newStatus === EqStatus.IN_USE) {
      updateEquipment(id, { status: newStatus, maintenanceDetails: undefined });
    } else {
      updateEquipmentStatus(id, newStatus);
    }
  };

  const handleVolumeSave = async (id: string, value: string, maxCapacity: number) => {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed < 0 || parsed > maxCapacity) {
      notify(`Please enter a valid volume between 0 and ${maxCapacity.toLocaleString()} L`, 'error');
      setEditingVolumeEqId(null);
      return;
    }
    
    try {
      await updateEquipment(id, { currentVolume: parsed });
      notify(`Successfully updated payload level to ${parsed.toLocaleString()} L`, 'success');
    } catch (err) {
      console.error("Failed to update equipment volume:", err);
      notify("Failed to update payload level", "error");
    } finally {
      setEditingVolumeEqId(null);
    }
  };


  const toggleCategory = (type: string) => {
    setExpandedCategories(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const sendRefuelRequest = async (eqId: string) => {
    if (pendingRequests.has(eqId)) return;
    
    try {
      // Check for duplicates locally first for immediate feedback
      const isRequested = (alerts || []).some(a => a && !a.acknowledged && a.message.includes(`Replenishment requested for unit ${eqId}`));
      if (isRequested) {
        notify(`A replenishment request is already active for ${eqId}`, 'warning');
        return;
      }

      setPendingRequests(prev => new Set(prev).add(eqId));

      const success = await createAlert({
        severity: 'medium',
        message: `Replenishment requested for unit ${eqId}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        acknowledged: false,
        targetRole: UserRole.DEPOT_OPERATOR
      });
      
      if (success) {
        await updateEquipmentStatus(eqId, EqStatus.REFUELLING);
        notify(`Refuel request sent to Depot Operators for ${eqId}`, 'success');
      }
    } catch (error) {
      console.error("Failed to send refuel request alert", error);
      notify(`Failed to send refuel request for ${eqId}`, 'error');
    } finally {
      setPendingRequests(prev => {
        const next = new Set(prev);
        next.delete(eqId);
        return next;
      });
    }
  };

  const filteredEquipment = (equipment || []).filter(eq => {
    if (!eq) return false;
    if (isItpStaff && (eq.type === EquipmentType.DIESEL_TRUCK || eq.type === EquipmentType.HYDRANT_SERVICE)) return false;
    const matchesSearch = (eq.name || eq.id || '').toLowerCase().includes((searchTerm || '').toLowerCase());
    const matchesFilter = filterType === 'All' || eq.type === filterType;
    return matchesSearch && matchesFilter;
  });

  const getStatusColor = (status: EqStatus) => {
    switch (status) {
      case EqStatus.AVAILABLE: return 'bg-success/10 text-success border-success/20';
      case EqStatus.IN_USE: return 'bg-primary/10 text-primary border-primary/20';
      case EqStatus.MAINTENANCE: return 'bg-warning/10 text-warning border-warning/20';
      case EqStatus.OUT_OF_SERVICE: return 'bg-error/10 text-error border-error/20';
      case EqStatus.REFUELLING: return 'bg-warning/10 text-warning border-warning/20';
      default: return 'bg-surface-dim text-on-surface-dim border-outline';
    }
  };

  const getStatusDropdownPillClass = (status: EqStatus) => {
    const base = "relative flex items-center px-2.5 py-1 rounded-full text-[9px] font-black border uppercase tracking-widest transition-all duration-300 hover:scale-[1.02] status-dropdown-pill";
    switch (status) {
      case EqStatus.AVAILABLE:
        return `${base} status-dropdown-pill-available`;
      case EqStatus.IN_USE:
        return `${base} status-dropdown-pill-in_use`;
      case EqStatus.MAINTENANCE:
        return `${base} status-dropdown-pill-maintenance`;
      case EqStatus.OUT_OF_SERVICE:
        return `${base} status-dropdown-pill-out_of_service`;
      case EqStatus.REFUELLING:
        return `${base} status-dropdown-pill-refuelling`;
      default:
        return `${base} border-outline text-on-surface bg-surface-dim hover:bg-surface-lowest`;
    }
  };

  const getStatusGradient = (status: EqStatus) => {
    switch (status) {
      case EqStatus.AVAILABLE: return 'gradient-success-no-glow';
      case EqStatus.IN_USE: return 'kinetic-gradient-no-glow';
      case EqStatus.MAINTENANCE: return 'gradient-warning-no-glow';
      case EqStatus.OUT_OF_SERVICE: return 'gradient-error-no-glow';
      case EqStatus.REFUELLING: return 'gradient-warning-no-glow';
      default: return 'kinetic-gradient-no-glow';
    }
  };

  const getStatusIcon = (status: EqStatus) => {
    switch (status) {
      case EqStatus.AVAILABLE: return <CheckCircle2 className="w-4 h-4" />;
      case EqStatus.IN_USE: return <Truck className="w-4 h-4" />;
      case EqStatus.MAINTENANCE: return <Wrench className="w-4 h-4" />;
      case EqStatus.OUT_OF_SERVICE: return <AlertCircle className="w-4 h-4" />;
      case EqStatus.REFUELLING: return <Fuel className="w-4 h-4" />;
      default: return null;
    }
  };

  const isOutOfService = (status: EqStatus) => 
    status === EqStatus.MAINTENANCE || status === EqStatus.OUT_OF_SERVICE;

  // Grouping logic
  const equipmentByType = Object.values(EquipmentType)
    .filter(type => !isItpStaff || (type !== EquipmentType.DIESEL_TRUCK && type !== EquipmentType.HYDRANT_SERVICE))
    .reduce((acc, type) => {
      const items = filteredEquipment.filter(eq => eq.type === type);
      if (items.length > 0 || filterType === type) {
        acc[type] = {
          inService: items.filter(eq => !isOutOfService(eq.status)),
          outOfService: items.filter(eq => isOutOfService(eq.status))
        };
      }
      return acc;
    }, {} as Record<string, { inService: Equipment[], outOfService: Equipment[] }>);

  const exportToPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      notify('Please allow popups to generate PDF report', 'warning');
      return;
    }

    const today = new Date();
    const formattedDate = `${today.getDate()}-${today.toLocaleString('default', { month: 'short' })}-${today.getFullYear().toString().slice(-2)} ${today.getHours().toString().padStart(2, '0')}:${today.getMinutes().toString().padStart(2, '0')}`;

    const pdfEquipment = (equipment || []).filter(eq => 
      eq.type !== EquipmentType.DIESEL_TRUCK && 
      eq.type !== EquipmentType.HYDRANT_SERVICE
    );
    const inServiceEquipment = pdfEquipment.filter(eq => !isOutOfService(eq.status)).sort((a, b) => a.name.localeCompare(b.name));
    const outOfServiceEquipment = pdfEquipment.filter(eq => isOutOfService(eq.status)).sort((a, b) => a.name.localeCompare(b.name));

    const inServiceHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>EQUIPMENT<br/>NO.</th>
            <th>CAPACITY<br/>(LITRES)</th>
          </tr>
        </thead>
        <tbody>
          ${inServiceEquipment.map(eq => `
            <tr>
              <td class="text-success">${eq.name}</td>
              <td class="text-success">${eq.maxCapacity > 0 ? eq.maxCapacity.toLocaleString() : '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    const outOfServiceHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>EQUIPMENT<br/>NO.</th>
            <th>CAPACITY<br/>(LITRES)</th>
            <th style="background-color: #f1f5f9;">JOB TYPE</th>
            <th style="background-color: #f1f5f9;">DETAIL DESCRIPTION</th>
            <th style="background-color: #fde047; color: #000;">ACTION REQUIRED BY</th>
            <th style="background-color: #e2e8f0;">BREAKDOWN<br/>DATE</th>
            <th style="background-color: #e2e8f0;">EXPECTED DATE<br/>BACK IN SERVICE</th>
            <th style="background-color: #e2e8f0;">NO. OF<br/>DAYS</th>
          </tr>
        </thead>
        <tbody>
          ${outOfServiceEquipment.map(eq => {
            const m = eq.maintenanceDetails;
            let days = '';
            if (m?.breakdownDate) {
               const breakdown = new Date(m.breakdownDate);
               const diffTime = Math.abs(today.getTime() - breakdown.getTime());
               const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
               days = diffDays.toString();
            }
            return `
            <tr>
              <td class="text-error">${eq.name}</td>
              <td class="text-error">${eq.maxCapacity > 0 ? eq.maxCapacity.toLocaleString() : '-'}</td>
              <td class="text-error">${m?.jobType || ''}</td>
              <td class="text-error">${m?.description || ''}</td>
              <td class="text-error">${m?.actionRequiredBy || ''}</td>
              <td>${m?.breakdownDate ? new Date(m.breakdownDate).toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: '2-digit'}).replace(/ /g, '-') : ''}</td>
              <td>${m?.expectedReturnDate ? new Date(m.expectedReturnDate).toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: '2-digit'}).replace(/ /g, '-') : ''}</td>
              <td class="text-error">${days}</td>
            </tr>
          `}).join('')}
        </tbody>
      </table>
    `;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Fuel Services</title>
        <style>
          @page { size: A4 landscape; margin: 0; }
          body { font-family: 'Arial', sans-serif; font-size: 11px; margin: 0; padding: 10mm; color: #000; background-color: #fff; }
          
          .receipt-box {
            border: 3px solid #000;
            padding: 20px;
            min-height: 170mm;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
          }

          .brand-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #000;
            padding-bottom: 12px;
            margin-bottom: 15px;
          }

          .brand-left h2 {
            font-size: 13px;
            font-weight: 900;
            margin: 0;
            line-height: 1.2;
            text-transform: uppercase;
            letter-spacing: -0.02em;
          }

          .brand-left h3.sub-1 {
            font-size: 11px;
            font-weight: 700;
            color: #4b5563;
            margin: 2px 0 0 0;
            line-height: 1.2;
            text-transform: uppercase;
          }

          .brand-left h3.sub-2 {
            font-size: 10px;
            font-weight: 500;
            color: #6b7280;
            margin: 2px 0 0 0;
            line-height: 1.2;
            text-transform: uppercase;
          }

          .logo img {
            height: 45px;
          }

          .title-container {
            text-align: center;
            margin-bottom: 20px;
          }

          .title {
            font-size: 18px;
            font-weight: 900;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            border-bottom: 2px solid #000;
            display: inline-block;
            padding: 4px 40px;
            margin: 0 0 10px 0;
          }

          .date {
            font-size: 11px;
            font-weight: bold;
          }
          
          .tables-container {
            display: flex;
            gap: 25px;
            align-items: flex-start;
            flex: 1;
          }
          
          .left-col {
            width: 230px;
            flex-shrink: 0;
          }

          .right-col {
            flex-grow: 1;
          }
          
          .section-title {
            font-size: 13px;
            font-weight: 900;
            text-transform: uppercase;
            margin-bottom: 8px;
            border-bottom: 1.5px solid #000;
            padding-bottom: 3px;
          }

          .text-success {
            color: #16a34a;
            font-weight: bold;
          }

          .text-error {
            color: #dc2626;
            font-weight: bold;
          }
          
          .data-table {
            border-collapse: collapse;
            width: 100%;
            border: 1.5px solid #000;
          }

          .data-table th, .data-table td {
            border: 1px solid #000;
            padding: 5px;
            text-align: center;
            font-size: 10px;
          }

          .data-table th {
            background-color: #f8fafc;
            font-weight: 900;
            color: #000;
            text-transform: uppercase;
            border-bottom: 1.5px solid #000;
          }

          .footer {
            display: flex;
            align-items: flex-end;
            border-top: 2px solid #000;
            padding-top: 15px;
            margin-top: 25px;
          }

          .prepared-by {
            display: flex;
            flex-direction: column;
            width: 250px;
          }

          .prepared-by .label {
            font-size: 8px;
            font-weight: 900;
            color: #6b7280;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            margin-bottom: 5px;
          }

          .prepared-by .val {
            font-size: 12px;
            font-weight: bold;
            color: #1e3a8a;
            font-style: italic;
          }

          .prepared-by .role {
            font-size: 9px;
            font-weight: bold;
            color: #4b5563;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
        </style>
      </head>
      <body>
        <div class="receipt-box">
          <div class="brand-header">
            <div class="brand-left">
              <h2>FUEL SERVICES SECTION</h2>
              <h3 class="sub-1">VELANA INTERNATIONAL AIRPORT</h3>
              <h3 class="sub-2">MALDIVES AIRPORTS COMPANY LTD</h3>
            </div>
            <div class="logo">
              <img src="https://static.routesonline.com/images/cached/organisation-14252-scaled-300x130.png" alt="MACL Logo" />
            </div>
          </div>

          <div class="title-container">
            <h1 class="title">REFUELLING EQUIPMENT STATUS</h1>
            <div class="date">DATE & TIME: &nbsp;&nbsp;&nbsp;${formattedDate}</div>
          </div>

          <div class="tables-container">
            <div class="left-col">
              <div class="section-title text-success">IN SERVICE</div>
              ${inServiceHTML}
            </div>
            
            <div class="right-col">
              <div class="section-title text-error">OUT OF SERVICE</div>
              ${outOfServiceHTML}
            </div>
          </div>

          <div class="footer">
            <div class="prepared-by">
              <span class="label">PREPARED BY:</span>
              <span class="val">${user.name}</span>
              <span class="role">${user.role.replace(/_/g, ' ')}</span>
            </div>
          </div>
        </div>

        <script>
          window.onload = () => {
            window.print();
            setTimeout(() => window.close(), 500);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="p-4 lg:p-10 space-y-6 lg:space-y-10">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 lg:gap-10 border-b border-outline pb-6 lg:pb-10">
        <div className="flex flex-col">
          <h2 className="headline-lg tracking-tighter mb-1 lg:mb-2 uppercase flex items-center">
            EQUIPMENT <span className="text-primary italic font-medium ml-2 lg:ml-3">COMMAND</span>
          </h2>
          <div className="flex items-center space-x-3">
             <span className="text-[9px] lg:text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-[0.2em] lg:tracking-[0.3em] font-mono">Live Sync: ACTIVE</span>
             <div className="h-1 w-1 rounded-full bg-on-surface-dim opacity-20"></div>
             <span className="text-[9px] lg:text-[10px] font-black text-primary uppercase tracking-[0.2em] lg:tracking-[0.3em]">{filteredEquipment.length} Tactical units online</span>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 lg:gap-4 w-full sm:w-auto">
          <div className="flex w-full sm:w-auto items-center gap-2">
            <div className="relative group flex-1 sm:flex-none">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-dim opacity-40 group-focus-within:text-primary transition-colors" />
              <input 
                type="text" 
                placeholder="ID SEARCH..."
                className="pl-12 pr-6 py-2 lg:py-2.5 bg-surface-dim border border-outline rounded-xl text-[10px] font-black uppercase tracking-widest placeholder:opacity-20 focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none w-full sm:w-48 lg:w-56 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            {user && ![UserRole.ITP_OPERATOR, UserRole.ITP_HD_OPERATOR, UserRole.ITP_OFFICER, UserRole.ITP_SUPERVISOR].includes(user.role) && (
              <button
                onClick={exportToPDF}
                className="flex items-center justify-center p-2 lg:px-4 lg:py-2 bg-primary/10 text-primary border border-primary/20 rounded-xl hover-kinetic-gradient transition-all active:scale-95 flex-shrink-0"
                title="Export Status (PDF)"
              >
                <FileText className="w-5 h-5 lg:w-4 lg:h-4 lg:mr-2" />
                <span className="hidden lg:inline text-[10px] font-black uppercase tracking-widest">Export Status (PDF)</span>
              </button>
            )}
          </div>
          
          <div className="bg-surface-dim p-1 rounded-2xl border border-outline relative flex w-fit max-w-full sm:w-auto overflow-x-visible md:overflow-x-auto no-scrollbar shadow-inner">
            <div 
              className={`absolute top-1 bottom-1 rounded-xl kinetic-gradient-no-glow transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-premium
                ${filterType === 'All' ? 'left-1 w-[48px] translate-x-0 md:w-[70px] md:translate-x-0' : ''}
                ${filterType === EquipmentType.REFUELLER ? 'left-1 w-[48px] translate-x-[48px] md:w-[100px] md:translate-x-[70px]' : ''}
                ${filterType === EquipmentType.HYDRANT_DISPENSER ? 'left-1 w-[48px] translate-x-[96px] md:w-[150px] md:translate-x-[170px]' : ''}
                ${filterType === EquipmentType.DIESEL_TRUCK ? 'left-1 w-[48px] translate-x-[144px] md:w-[110px] md:translate-x-[320px]' : ''}
                ${filterType === EquipmentType.HYDRANT_SERVICE ? 'left-1 w-[48px] translate-x-[192px] md:w-[140px] md:translate-x-[430px]' : ''}
              `}
            />
            <button
              onClick={() => {
                setFilterType('All');
                triggerTooltip('All');
              }}
              className={`w-[48px] md:w-[70px] flex-shrink-0 flex items-center justify-center py-2 text-[8px] md:text-[9px] font-black uppercase tracking-widest transition-all relative z-10 ${
                filterType === 'All' ? 'text-white' : 'text-on-surface-dim hover:text-on-surface'
              }`}
            >
              {activeTooltip === 'All' && (
                <div className="absolute bottom-full mb-3 bg-surface-container border border-outline px-2.5 py-1.5 rounded-xl text-[9px] font-black text-on-surface uppercase tracking-widest shadow-premium z-50 whitespace-nowrap animate-in fade-in slide-in-from-bottom-1 duration-200 md:hidden">
                  All Vehicles
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-surface-container" />
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-outline -z-10 mt-[1px]" />
                </div>
              )}
              <Layers className="w-3.5 h-3.5 md:hidden" />
              <span className="hidden md:inline">ALL</span>
            </button>
            {Object.values(EquipmentType)
              .filter(type => !isItpStaff || (type !== EquipmentType.DIESEL_TRUCK && type !== EquipmentType.HYDRANT_SERVICE))
              .map((type) => {
                const widthClass = type === EquipmentType.REFUELLER ? 'w-[48px] md:w-[100px]' : 
                                   type === EquipmentType.HYDRANT_DISPENSER ? 'w-[48px] md:w-[150px]' :
                                   type === EquipmentType.DIESEL_TRUCK ? 'w-[48px] md:w-[110px]' : 'w-[48px] md:w-[140px]';
                
                const getTabIcon = (t: EquipmentType) => {
                  switch (t) {
                    case EquipmentType.REFUELLER:
                      return <Truck className="w-3.5 h-3.5" />;
                    case EquipmentType.HYDRANT_DISPENSER:
                      return <Droplet className="w-3.5 h-3.5" />;
                    case EquipmentType.DIESEL_TRUCK:
                      return <Fuel className="w-3.5 h-3.5" />;
                    case EquipmentType.HYDRANT_SERVICE:
                      return <Wrench className="w-3.5 h-3.5" />;
                    default:
                      return null;
                  }
                };

                return (
                  <button
                    key={type}
                    onClick={() => {
                      setFilterType(type);
                      triggerTooltip(type);
                    }}
                    className={`${widthClass} flex-shrink-0 flex items-center justify-center py-2 text-[8px] md:text-[9px] font-black uppercase tracking-widest transition-all relative z-10 ${
                      filterType === type ? 'text-white' : 'text-on-surface-dim hover:text-on-surface'
                    }`}
                  >
                    {activeTooltip === type && (
                      <div className="absolute bottom-full mb-3 bg-surface-container border border-outline px-2.5 py-1.5 rounded-xl text-[9px] font-black text-on-surface uppercase tracking-widest shadow-premium z-50 whitespace-nowrap animate-in fade-in slide-in-from-bottom-1 duration-200 md:hidden">
                        {type.replace('_', ' ')}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-surface-container" />
                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-outline -z-10 mt-[1px]" />
                      </div>
                    )}
                    <span className="md:hidden">{getTabIcon(type)}</span>
                    <span className="hidden md:inline">{type.replace('_', ' ')}</span>
                  </button>
                );
              })}
          </div>
        </div>
      </div>

      <div className="space-y-4 lg:space-y-6">
        {Object.entries(equipmentByType).map(([type, statusGroups]) => (
          <div key={`${type}-${filterType}`} className="bg-surface-lowest rounded-2xl lg:rounded-3xl p-4 lg:p-8 border border-outline shadow-sm relative overflow-hidden group/section animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="absolute top-0 right-0 w-[200px] lg:w-[300px] h-[200px] lg:h-[300px] bg-primary/5 rounded-full blur-[60px] lg:blur-[80px] -mr-20 lg:-mr-32 -mt-20 lg:-mt-32 pointer-events-none group-hover/section:bg-primary/10 transition-all duration-700"></div>
            
            <div 
              className="flex items-center justify-between mb-6 lg:mb-8 cursor-pointer group/header relative z-10"
              onClick={() => toggleCategory(type)}
            >
              <div className="flex items-center">
                <div className={`p-2 lg:p-3 bg-surface-dim rounded-xl border transition-all shadow-sm active:scale-95 mr-3 lg:mr-4 group-hover/header:border-primary ${
                  expandedCategories[type] ? 'border-primary/50 bg-primary/5' : 'border-outline'
                }`}>
                  {type === EquipmentType.REFUELLER && <Truck className={`w-4 h-4 lg:w-5 lg:h-5 transition-all duration-300 ${expandedCategories[type] ? 'text-primary scale-110' : 'text-on-surface-dim opacity-70'}`} />}
                  {type === EquipmentType.HYDRANT_DISPENSER && <Droplet className={`w-4 h-4 lg:w-5 lg:h-5 transition-all duration-300 ${expandedCategories[type] ? 'text-primary scale-110' : 'text-on-surface-dim opacity-70'}`} />}
                  {type === EquipmentType.DIESEL_TRUCK && <Fuel className={`w-4 h-4 lg:w-5 lg:h-5 transition-all duration-300 ${expandedCategories[type] ? 'text-primary scale-110' : 'text-on-surface-dim opacity-70'}`} />}
                  {type === EquipmentType.HYDRANT_SERVICE && <Wrench className={`w-4 h-4 lg:w-5 lg:h-5 transition-all duration-300 ${expandedCategories[type] ? 'text-primary scale-110' : 'text-on-surface-dim opacity-70'}`} />}
                </div>
                <div>
                  <h3 className="text-xl lg:text-2xl font-[900] text-on-surface tracking-tighter uppercase italic">{type} FLEET</h3>
                  <div className="flex items-center gap-3 lg:gap-4 mt-1.5">
                    <span className="text-[8px] lg:text-[9px] font-black text-success uppercase tracking-widest flex items-center">
                      <div className="w-1.5 h-1.5 bg-success rounded-full mr-1.5 shadow-[0_0_8px_rgba(34,197,94,0.4)]"></div>
                      {statusGroups.inService.length} ACTIVE
                    </span>
                    {statusGroups.outOfService.length > 0 && (
                      <span className="text-[8px] lg:text-[9px] font-black text-error uppercase tracking-widest flex items-center opacity-60">
                        <div className="w-1.5 h-1.5 bg-error rounded-full mr-1.5"></div>
                        {statusGroups.outOfService.length} GROUNDED
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {expandedCategories[type] && (
              <div className="space-y-6 lg:space-y-8 relative z-10">
                {/* In Service Section */}
                {statusGroups.inService.length > 0 && (
                  <div>
                    <h4 className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.3em] mb-4 flex items-center opacity-40">
                      <span className="w-6 h-0.5 bg-primary/30 mr-3"></span>
                      TASK READY ASSETS
                    </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 lg:gap-8">
                        {statusGroups.inService.map(eq => (
                          <div key={eq.id} className="card-premium bg-surface-dim border border-white/10 flex flex-col group transition-all duration-500 hover:scale-[1.02] hover:border-primary/30 hover:shadow-glow shadow-premium">
                          <div className="p-5 md:p-6 flex-1">
                            <div className="flex justify-between items-start mb-6">
                              <div>
                                <h3 className="text-xl font-[900] text-on-surface group-hover:text-primary transition-colors tracking-tighter italic">{eq.name}</h3>
                                <p className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-40">{eq.type}</p>
                              </div>
                              {canEdit ? (
                                <div className={getStatusDropdownPillClass(eq.status)}>
                                  {getStatusIcon(eq.status)}
                                  <select
                                    value={eq.status}
                                    onChange={(e) => handleStatusChange(eq.id, e.target.value as EqStatus)}
                                    className="bg-transparent border-none text-[9px] font-black uppercase tracking-widest outline-none cursor-pointer appearance-none pl-1 pr-1 text-center w-full text-current select-custom-reset"
                                    style={{ WebkitAppearance: 'none', MozAppearance: 'none', textAlignLast: 'center' }}
                                  >
                                    {Object.values(EqStatus).map(status => (
                                      <option key={status} value={status} className="bg-surface-dim text-on-surface uppercase font-black">
                                        {status.toUpperCase().replace('_', ' ')}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              ) : (
                                <div className={`flex items-center space-x-2 px-2.5 py-1 rounded-full text-[9px] font-black border uppercase tracking-widest ${getStatusColor(eq.status)}`}>
                                  {getStatusIcon(eq.status)}
                                  <span className="ml-1">{eq.status}</span>
                                </div>
                              )}
                            </div>

                            {eq.maxCapacity > 0 && (
                              <div className="mb-6 bg-surface-lowest border border-outline p-4 rounded-2xl shadow-inner">
                                <div className="flex justify-between items-end mb-2">
                                  <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-40">Payload Sync</span>
                                  {editingVolumeEqId === eq.id ? (
                                    <div className="flex items-center space-x-1">
                                      <input
                                        type="number"
                                        value={tempVolumeVal}
                                        min="0"
                                        max={eq.maxCapacity}
                                        onChange={(e) => setTempVolumeVal(e.target.value)}
                                        className="w-20 bg-surface-dim border border-primary rounded-lg px-2 py-0.5 text-xs text-on-surface font-bold focus:outline-none"
                                        autoFocus
                                        onBlur={() => handleVolumeSave(eq.id, tempVolumeVal, eq.maxCapacity)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            handleVolumeSave(eq.id, tempVolumeVal, eq.maxCapacity);
                                          } else if (e.key === 'Escape') {
                                            setEditingVolumeEqId(null);
                                          }
                                        }}
                                      />
                                      <span className="text-xs font-black text-on-surface-dim">/ {eq.maxCapacity.toLocaleString()} L</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center space-x-1.5">
                                      <span className="text-xs font-black text-on-surface tracking-tighter">{eq.currentVolume.toLocaleString()} / {eq.maxCapacity.toLocaleString()} L</span>
                                      {canEdit && (eq.type === EquipmentType.REFUELLER || eq.type === EquipmentType.DIESEL_TRUCK) && (
                                        <button 
                                          onClick={() => {
                                            setEditingVolumeEqId(eq.id);
                                            setTempVolumeVal(eq.currentVolume.toString());
                                          }}
                                          className="text-on-surface-dim hover:text-primary transition-colors p-0.5 rounded hover:bg-surface-dim"
                                          title="Adjust fuel level"
                                        >
                                          <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div className="w-full bg-surface-dim h-1.5 rounded-full overflow-hidden shadow-inner">
                                  <div 
                                    className="bg-primary h-full transition-all duration-1000 ease-out shadow-premium"
                                    style={{ width: `${(eq.currentVolume / eq.maxCapacity) * 100}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Status Override removed from bottom, integrated into top-right status badge */}
                          </div>

                          <div className="bg-surface-dim/40 p-4 border-t border-outline flex justify-between items-center group-hover:bg-primary/5 transition-colors">
                            <span className="text-[9px] font-black text-on-surface-dim opacity-30 uppercase tracking-widest">
                              {new Date(eq.lastUpdated).toLocaleTimeString([], { hour12: false })}
                            </span>
                            {eq.type === EquipmentType.REFUELLER && canEdit && (
                              <button 
                                onClick={() => sendRefuelRequest(eq.id)}
                                disabled={pendingRequests.has(eq.id) || alerts.some(a => !a.acknowledged && a.message.includes(`Replenishment requested for unit ${eq.id}`))}
                                className={`flex items-center text-[9px] font-black px-2 py-1.5 lg:px-3 lg:py-2 rounded-xl border border-outline shadow-sm transition-all active:scale-95 uppercase tracking-widest ${
                                  pendingRequests.has(eq.id) || alerts.some(a => !a.acknowledged && a.message.includes(`Replenishment requested for unit ${eq.id}`))
                                  ? 'bg-surface-lowest text-on-surface-dim opacity-30 cursor-not-allowed'
                                  : 'text-primary bg-surface-lowest btn-replenish-hover'
                                }`}
                              >
                                <Send className={`w-3 h-3 mr-1.5 ${pendingRequests.has(eq.id) ? 'animate-pulse' : ''}`} />
                                {pendingRequests.has(eq.id) ? 'SENDING...' : 'REPLENISH'}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Out of Service Section */}
                {statusGroups.outOfService.length > 0 && (
                  <div className="pt-6">
                    <h4 className="text-[9px] font-black text-error uppercase tracking-[0.3em] mb-4 flex items-center opacity-60">
                      <span className="w-6 h-0.5 bg-error/20 mr-3"></span>
                      GROUNDED / MAINT
                    </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 lg:gap-8">
                        {statusGroups.outOfService.map(eq => (
                          <div key={eq.id} className="bg-surface-dim/60 border border-white/5 rounded-[24px] overflow-hidden flex flex-col opacity-75 grayscale-[0.6] hover:opacity-100 hover:grayscale-0 transition-all duration-500 hover:border-error/30 shadow-premium">
                          <div className="p-5 md:p-6 flex-1 relative">
                            <div className="absolute top-0 right-0 p-5 w-full flex justify-end">
                              <AlertCircle className="w-6 h-6 text-error opacity-10" />
                            </div>
                            <div className="flex justify-between items-start mb-6">
                              <div>
                                <h3 className="text-xl font-[900] text-on-surface-dim tracking-tighter italic uppercase">{eq.name}</h3>
                                <p className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-40">{eq.type}</p>
                              </div>
                              {canEdit ? (
                                <div className={getStatusDropdownPillClass(eq.status)}>
                                  {getStatusIcon(eq.status)}
                                  <select
                                    value={eq.status}
                                    onChange={(e) => handleStatusChange(eq.id, e.target.value as EqStatus)}
                                    className="bg-transparent border-none text-[9px] font-black uppercase tracking-widest outline-none cursor-pointer appearance-none pl-1 pr-1 text-center w-full text-current select-custom-reset"
                                    style={{ WebkitAppearance: 'none', MozAppearance: 'none', textAlignLast: 'center' }}
                                  >
                                    {Object.values(EqStatus).map(status => (
                                      <option key={status} value={status} className="bg-surface-dim text-on-surface uppercase font-black">
                                        {status.toUpperCase().replace('_', ' ')}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              ) : (
                                <div className={`flex items-center space-x-2 px-2.5 py-1 rounded-full text-[9px] font-black border uppercase tracking-widest ${getStatusColor(eq.status)}`}>
                                  {getStatusIcon(eq.status)}
                                  <span className="ml-1">{eq.status}</span>
                                </div>
                              )}
                            </div>

                            {canEdit && (
                              <div className="mt-6 pt-5 border-t border-error/5">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingMaintEq(eq);
                                    setMaintForm({
                                      jobType: eq.maintenanceDetails?.jobType || 'MAINTENANCE',
                                      description: eq.maintenanceDetails?.description || '',
                                      actionRequiredBy: eq.maintenanceDetails?.actionRequiredBy || 'FUEL',
                                      breakdownDate: eq.maintenanceDetails?.breakdownDate || new Date().toISOString().split('T')[0],
                                      expectedReturnDate: eq.maintenanceDetails?.expectedReturnDate || ''
                                    });
                                  }}
                                  className="w-full py-2.5 rounded-xl text-[9px] font-black transition-all border uppercase tracking-[0.2em] bg-surface-lowest text-on-surface-dim border-outline hover:border-warning/30 hover:text-warning flex items-center justify-center group/btn"
                                >
                                  <FileText className="w-3.5 h-3.5 mr-2 group-hover/btn:scale-110 transition-transform" />
                                  Edit Maint. Details
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="bg-error/[0.03] p-4 border-t border-error/5 flex justify-between items-center text-error opacity-60">
                            <span className="text-[9px] font-black uppercase tracking-widest italic">Operations Restriction Active</span>
                            <Wrench className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      
      {editingMaintEq && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-300">
          <div className="bg-surface-dim border border-outline rounded-3xl w-full max-w-md shadow-premium overflow-hidden my-auto">
            <div className="p-6 border-b border-outline flex justify-between items-center bg-surface-lowest">
              <div>
                <h3 className="text-xl font-[900] text-on-surface tracking-tighter uppercase italic">{editingMaintEq.name} Maintenance</h3>
                <p className="text-[10px] font-black text-on-surface-dim uppercase tracking-widest mt-1 opacity-60">Update Log Details</p>
              </div>
              <button 
                onClick={() => setEditingMaintEq(null)}
                className="p-2 hover:bg-surface-container rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-on-surface-dim" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-2 tracking-[0.2em]">Job Type</label>
                <select 
                  className="w-full bg-surface-lowest border border-outline rounded-xl px-4 py-3 text-sm text-on-surface focus:border-primary outline-none"
                  value={maintForm.jobType}
                  onChange={e => setMaintForm({...maintForm, jobType: e.target.value as any})}
                >
                  <option value="MAINTENANCE">MAINTENANCE</option>
                  <option value="BREAKDOWN">BREAKDOWN</option>
                  <option value="ROUTINE SERVICE">ROUTINE SERVICE</option>
                  <option value="MAINTENANCE WORK">MAINTENANCE WORK</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-2 tracking-[0.2em]">Detail Description</label>
                <input 
                  type="text"
                  className="w-full bg-surface-lowest border border-outline rounded-xl px-4 py-3 text-sm text-on-surface focus:border-primary outline-none"
                  value={maintForm.description}
                  onChange={e => setMaintForm({...maintForm, description: e.target.value})}
                  placeholder="E.g. Lock issue & gear transmission"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-2 tracking-[0.2em]">Action Required By</label>
                <select 
                  className="w-full bg-surface-lowest border border-outline rounded-xl px-4 py-3 text-sm text-on-surface focus:border-primary outline-none"
                  value={maintForm.actionRequiredBy}
                  onChange={e => setMaintForm({...maintForm, actionRequiredBy: e.target.value as any})}
                >
                  <option value="FUEL">FUEL</option>
                  <option value="PROCUREMENT">PROCUREMENT</option>
                  <option value="MECHANICAL">MECHANICAL</option>
                  <option value="FUEL MAINTENANCE">FUEL MAINTENANCE</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-2 tracking-[0.2em]">Breakdown Date</label>
                  <div className="relative">
                    <input 
                      type="date"
                      className="w-full pl-10 pr-4 py-3 bg-surface-lowest border border-outline rounded-xl text-sm text-on-surface focus:border-primary outline-none cursor-pointer"
                      value={maintForm.breakdownDate}
                      onChange={e => setMaintForm({...maintForm, breakdownDate: e.target.value})}
                      onClick={(e) => { try { if ('showPicker' in HTMLInputElement.prototype) (e.target as HTMLInputElement).showPicker(); } catch {} }}
                    />
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary opacity-50 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-2 tracking-[0.2em]">Expected Return</label>
                  <div className="relative">
                    <input 
                      type="date"
                      className="w-full pl-10 pr-4 py-3 bg-surface-lowest border border-outline rounded-xl text-sm text-on-surface focus:border-primary outline-none cursor-pointer"
                      value={maintForm.expectedReturnDate}
                      onChange={e => setMaintForm({...maintForm, expectedReturnDate: e.target.value})}
                      onClick={(e) => { try { if ('showPicker' in HTMLInputElement.prototype) (e.target as HTMLInputElement).showPicker(); } catch {} }}
                    />
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary opacity-50 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-outline flex justify-end gap-3 bg-surface-lowest">
              <button 
                onClick={() => setEditingMaintEq(null)}
                className="px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-on-surface-dim hover:text-on-surface transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  updateEquipment(editingMaintEq.id, { maintenanceDetails: maintForm });
                  notify('Maintenance details updated', 'success');
                  setEditingMaintEq(null);
                }}
                className="px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest kinetic-gradient-no-glow text-white hover:opacity-90 transition-opacity shadow-premium"
              >
                Save Details
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      <style>{`
        html.modal-open, html.modal-open body {
          overflow: hidden !important;
          height: 100% !important;
        }
        @media (max-width: 1023px) {
          html.modal-open .sticky.top-0,
          html.modal-open header,
          html.modal-open .fixed.bottom-6 {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};
