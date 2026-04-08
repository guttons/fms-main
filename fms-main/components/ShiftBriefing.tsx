import React, { useState, useEffect } from 'react';
import { supabaseService } from '../services/supabaseService';
import { Save } from 'lucide-react';

export const ShiftBriefing: React.FC = () => {
  const [isSaving, setIsSaving] = useState(false);
  const [additionalInfo, setAdditionalInfo] = useState([
    { text: 'Ready before 15 mins/PPE/360 Walkaround check/Following speed limits/Marshaling when required', type: 'black' },
    { text: 'Officers should NOT stay inside the Bowser while refuelling is in progress', type: 'gray' },
    { text: 'The officer and operator have the responsibility to check and complete the daily refueller check', type: 'gray' },
    { text: 'All hose related issues must be reported with specific hose identification number clearly stated', type: 'gray', italic: true },
    { text: 'Rf 16 & 17 check if gear changed to NEUTRAL after parking', type: 'gray' },
    { text: 'Only water bottle is allowed on apron/ No food or drink is allowed', type: 'gray' },
    { text: 'DOUBLE CHECK IF TIMINGS ARE ENTERED CORRECTLY BEFORE SAVING LOG ENTRY', type: 'black', italic: true },
    { text: 'WITH SALES , CHECK IF THE TIMINGS ARE SAVED CORRECTLY TO LOG ENTRY', type: 'black', italic: true },
    { text: 'DO NOT USE SAME ARRIVED / STARTED TIME FOR SECOND REFUELLING INVOICE', type: 'black', italic: true },
  ]);

  const todayDate = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const loadBriefing = async () => {
      try {
        const data = await supabaseService.getShiftBriefingInfo(todayDate);
        if (data && data.length > 0) {
          setAdditionalInfo(data);
        }
      } catch (error) {
        console.error("Failed to load shift briefing:", error);
      }
    };
    loadBriefing();
  }, [todayDate]);

  const handleInfoChange = (index: number, newText: string) => {
    const newInfo = [...additionalInfo];
    newInfo[index].text = newText;
    setAdditionalInfo(newInfo);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await supabaseService.upsertShiftBriefingInfo(todayDate, additionalInfo);
      alert('Shift briefing saved successfully!');
    } catch (error) {
      console.error("Failed to save shift briefing:", error);
      alert('Failed to save shift briefing.');
    } finally {
      setIsSaving(false);
    }
  };

  // Mock Data to match the image
  const intFlights = [
    { flight: 'MU 9656', eta: '23:55', etd: '00:55', stand: '2R' },
    { flight: 'AI 3202', eta: 'DEP', etd: '06:45', stand: '8L' },
    { flight: 'Q2 706', eta: 'DEP', etd: '08:00', stand: '7R' },
  ];

  const domMaldivian = [
    { flight: 'Q2 128', time: '23:55', stand: 'T' },
    { flight: 'Q2 2112', time: '00:25', stand: 'Z', off: true },
    { flight: 'Q2 2268', time: '00:30', stand: 'X' },
    { flight: 'Q2 2248', time: '01:45', stand: 'W' },
    { flight: 'Q2 220', time: '04:45', stand: 'V' },
    { flight: 'Q2 260', time: '06:30', stand: 'Y' },
    { flight: 'Q2 132', time: '08:00', stand: 'T' },
    { flight: 'Q2 2472', time: '08:20', stand: 'V' },
    { flight: 'Q2 442', time: '08:25', stand: 'Z' },
  ];

  const officers = [
    { id: 'A-8724', name: 'ALEEF', checked: true, domDate: '10-Mar', domCount: 2, stockDate: '26-Feb', stockCount: 1 },
    { id: 'A-8288', name: 'SHAIKHAN', checked: true, off: true },
    { id: '', name: '', checked: false },
    { id: '', name: '', checked: false },
    { id: '', name: '', checked: false },
    { id: '', name: '', checked: false },
  ];

  const operators = [
    { id: '472', name: 'ZAREER', checked: true, domDate: '10-Mar', domCount: 4, dailyDate: '8-Mar', dailyCount: 4 },
    { id: 'A-8633', name: 'IS.WAHEED', checked: true, domDate: '04-Mar', domCount: 3, dailyDate: '5-Mar', dailyCount: 1 },
    { id: '', name: '', checked: false },
    { id: '', name: '', checked: false },
    { id: 'A-5582', name: 'MUSHFIQ', checked: true, hd: true, dailyDate: '5-Mar', dailyCount: 1 },
    { id: 'A-8581', name: 'MUNEEF', checked: true, hd: true, dailyDate: '5-Mar', dailyCount: 1 },
  ];

  const equipment = [
    { id: 'RF-02', status: 'IN SERVICE' },
    { id: 'RF-04', status: 'IN SERVICE' },
    { id: 'RF-06', status: 'IN SERVICE' },
    { id: 'RF-07', status: 'IN SERVICE' },
    { id: 'RF-10', status: 'IN SERVICE' },
    { id: 'RF-11', status: 'IN SERVICE' },
    { id: 'RF-12', status: 'IN SERVICE' },
    { id: 'HD-01', status: 'IN SERVICE' },
    { id: 'HD-02', status: 'IN SERVICE' },
    { id: 'HD-03', status: 'IN SERVICE' },
    { id: 'HD-04', status: 'IN SERVICE' },
    { id: 'RF-14', status: 'OUT OF SERVICE' },
    { id: 'RF-15', status: 'OUT OF SERVICE' },
    { id: 'RF-16', status: 'OUT OF SERVICE' },
    { id: 'RF-17', status: 'OUT OF SERVICE' },
  ];

  return (
    <div className="min-h-screen bg-white p-4 lg:p-8">
      <div className="max-w-[1200px] mx-auto bg-white text-black font-sans text-[11px] leading-tight">
        
        {/* Header */}
        <div className="border-b-2 border-black pb-1 mb-2">
          <div className="bg-black text-white px-2 py-1 inline-block font-bold mb-1 text-xs">
            Wednesday 11 March 26, 07:32 | Shift: MORNING
          </div>
          <h1 className="text-2xl font-bold tracking-tight uppercase">INTO-PLANE SHIFT INFO / BRIEFING</h1>
        </div>

        {/* Top Grid */}
        <div className="grid grid-cols-12 gap-x-4 mb-4">
          
          {/* Column 1: Flights (col-span-4) */}
          <div className="col-span-4 flex gap-x-2">
            
            {/* International */}
            <div className="flex-[1.2]">
              <div className="flex justify-between font-bold border-b-2 border-black mb-1 px-1">
                <span className="underline">INTERNATIONAL</span>
                <span>3</span>
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-black text-white">
                    <th className="p-1 border border-black font-bold">FLIGHT</th>
                    <th className="p-1 border border-black font-bold text-center">ETA</th>
                    <th className="p-1 border border-black font-bold text-center">ETD</th>
                    <th className="p-1 border border-black font-bold text-center w-6"></th>
                  </tr>
                </thead>
                <tbody>
                  {intFlights.map((f, i) => (
                    <tr key={i}>
                      <td className="p-1 border border-black font-bold">{f.flight}</td>
                      <td className="p-1 border border-black text-center">{f.eta}</td>
                      <td className="p-1 border border-black text-center">{f.etd}</td>
                      <td className="p-1 border border-black text-center font-bold">{f.stand}</td>
                    </tr>
                  ))}
                  {/* Empty rows for layout */}
                  {Array.from({ length: 9 }).map((_, i) => (
                    <tr key={`empty-int-${i}`} className={i % 2 === 0 ? 'bg-gray-100' : ''}>
                      <td className="p-2 border-none"></td>
                      <td className="p-2 border-none"></td>
                      <td className="p-2 border-none"></td>
                      <td className="p-2 border-none"></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Domestic */}
            <div className="flex-1">
              <div className="flex justify-between font-bold border-b-2 border-black mb-1 px-1">
                <span className="underline">DOMESTIC</span>
                <span>9</span>
              </div>
              
              {/* Maldivian */}
              <div className="bg-[#C8102E] text-white text-center font-bold py-0.5 mb-1">MALDIVIAN</div>
              <table className="w-full text-left border-collapse mb-2 relative">
                <tbody>
                  {domMaldivian.map((f, i) => (
                    <tr key={i} className="relative">
                      {f.off && <td className="absolute -left-6 top-1 text-[9px] font-bold">OFF</td>}
                      <td className="p-1 border-none">{f.flight}</td>
                      <td className="p-1 border-none text-center">{f.time}</td>
                      <td className="p-1 border-none text-center font-bold">{f.stand}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {/* Villa Air */}
              <div className="bg-[#B5D334] text-white text-center font-bold py-0.5 mb-1">VILLA AIR</div>
              <table className="w-full text-left border-collapse mb-2">
                <tbody>
                  <tr className="bg-gray-100"><td className="p-2 border-none"></td></tr>
                  <tr><td className="p-2 border-none"></td></tr>
                </tbody>
              </table>

              {/* Manta Air */}
              <div className="bg-[#2B3990] text-white text-center font-bold py-0.5 mb-1">MANTA AIR</div>
              <table className="w-full text-left border-collapse mb-2">
                <tbody>
                  <tr className="bg-gray-100"><td className="p-2 border-none"></td></tr>
                  <tr><td className="p-2 border-none"></td></tr>
                  <tr className="bg-gray-100"><td className="p-2 border-none"></td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Column 2: Staffing (col-span-5) */}
          <div className="col-span-5">
            <div className="text-center font-bold mb-0.5 text-sm">1</div>
            <table className="w-full text-left border-collapse mb-4">
              <thead>
                <tr>
                  <th colSpan={2} className="p-1 border border-black bg-black text-white font-bold">OFFICERS</th>
                  <th className="p-1 border border-black bg-black text-white font-bold text-center w-6">1</th>
                  <th colSpan={2} className="p-1 border border-black bg-[#C5E0B4] text-black font-bold text-center w-16">DOM</th>
                  <th colSpan={2} className="p-1 border border-black bg-[#E7E6E6] text-black font-bold text-center w-16">STOCK</th>
                </tr>
              </thead>
              <tbody>
                {officers.map((o, i) => (
                  <tr key={i} className="relative">
                    {o.off && <td className="absolute -left-6 top-1 text-[9px] font-bold">OFF</td>}
                    <td className="p-1 border border-black w-16">{o.id}</td>
                    <td className="p-1 border border-black">{o.name}</td>
                    <td className="p-1 border border-black text-center bg-white">
                      {o.name && (
                        <div className="w-3 h-3 border border-black mx-auto flex items-center justify-center bg-black text-white">
                          {o.checked && '✓'}
                        </div>
                      )}
                    </td>
                    <td className="p-1 border border-black text-center text-[10px] w-10 bg-[#E2EFDA]">{o.domDate}</td>
                    <td className="p-1 border border-black text-center bg-[#E2EFDA]">{o.domCount}</td>
                    <td className="p-1 border border-black text-center text-[10px] w-10 bg-[#F2F2F2]">{o.stockDate}</td>
                    <td className="p-1 border border-black text-center bg-[#F2F2F2]">{o.stockCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="text-center font-bold mb-0.5 text-sm">4</div>
            <table className="w-full text-left border-collapse mb-4">
              <thead>
                <tr>
                  <th colSpan={2} className="p-1 border border-black bg-black text-white font-bold">RF. OPERATORS</th>
                  <th className="p-1 border border-black bg-black text-white font-bold text-center w-6">4</th>
                  <th colSpan={2} className="p-1 border border-black bg-[#C5E0B4] text-black font-bold text-center w-16">DOM</th>
                  <th colSpan={2} className="p-1 border border-black bg-[#BDD7EE] text-black font-bold text-center w-16">DAILY</th>
                </tr>
              </thead>
              <tbody>
                {operators.map((o, i) => (
                  <tr key={i} className="relative">
                    {o.hd && <td className="absolute -left-5 top-1 text-[9px] font-bold">HD</td>}
                    <td className="p-1 border border-black w-16">{o.id}</td>
                    <td className="p-1 border border-black">{o.name}</td>
                    <td className="p-1 border border-black text-center bg-white">
                      {o.name && (
                        <div className="w-3 h-3 border border-black mx-auto flex items-center justify-center bg-black text-white">
                          {o.checked && '✓'}
                        </div>
                      )}
                    </td>
                    <td className="p-1 border border-black text-center text-[10px] w-10 bg-[#E2EFDA]">{o.domDate}</td>
                    <td className="p-1 border border-black text-center bg-[#E2EFDA]">{o.domCount}</td>
                    <td className="p-1 border border-black text-center text-[10px] w-10 bg-[#DDEBF7]">{o.dailyDate}</td>
                    <td className="p-1 border border-black text-center bg-[#DDEBF7]">{o.dailyCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex items-center gap-2 mb-4 mt-6">
              <div className="bg-black text-white px-2 py-0.5 font-bold text-xs">DOM 1</div>
              <div className="font-bold underline text-sm">ALEEF / IS.WAHEED</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-[#A6A6A6] text-white px-2 py-0.5 font-bold text-xs">STOCK</div>
              <div className="font-bold underline text-sm">No matching data</div>
            </div>
          </div>

          {/* Column 3: Equipment (col-span-3) */}
          <div className="col-span-3">
            <table className="w-full text-left border-collapse mb-4">
              <thead>
                <tr>
                  <th className="p-1 border border-black bg-black text-white font-bold">EQUIPMENT STATUS</th>
                  <th className="p-1 border border-black bg-black text-white font-bold text-center w-6">9</th>
                </tr>
              </thead>
              <tbody>
                {equipment.map((e, i) => (
                  <tr key={i}>
                    <td className="p-1 border border-black font-bold w-16">{e.id}</td>
                    <td className="p-1 border border-black">{e.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <table className="w-full text-left border-collapse mb-4 mt-6">
              <thead>
                <tr>
                  <th colSpan={3} className="p-1 border border-black bg-black text-white font-bold">SHIFT SUPERVISORS</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-1 border border-black w-16">A-1159</td>
                  <td className="p-1 border border-black">SHAREEF IB.</td>
                  <td className="p-1 border border-black text-center w-6">
                    <div className="w-3 h-3 border border-black mx-auto flex items-center justify-center bg-black text-white">✓</div>
                  </td>
                </tr>
                <tr>
                  <td className="p-3 border border-black"></td>
                  <td className="p-3 border border-black"></td>
                  <td className="p-3 border border-black"></td>
                </tr>
              </tbody>
            </table>

            <table className="w-full text-left border-collapse mb-4">
              <thead>
                <tr>
                  <th colSpan={3} className="p-1 border border-black bg-black text-white font-bold">SHIFT INCHARGE</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-1 border border-black w-16">A-3162</td>
                  <td className="p-1 border border-black">SAM AAN</td>
                  <td className="p-1 border border-black text-center w-6">
                    <div className="w-3 h-3 border border-black mx-auto flex items-center justify-center bg-black text-white">✓</div>
                  </td>
                </tr>
                <tr>
                  <td className="p-3 border border-black"></td>
                  <td className="p-3 border border-black"></td>
                  <td className="p-3 border border-black"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Middle Section */}
        <div className="grid grid-cols-12 gap-4 mb-4">
          <div className="col-span-9">
            <div className="flex justify-between items-center mb-1">
                <div className="bg-black text-white inline-block px-2 py-1 font-bold underline">ADDITIONAL INFO</div>
                <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center px-3 py-1 bg-aviation-600 text-white font-bold rounded hover:bg-aviation-700 disabled:opacity-50"
                >
                    <Save className="w-4 h-4 mr-1" />
                    {isSaving ? 'Saving...' : 'Save Info'}
                </button>
            </div>
            <div className="border border-black flex flex-col">
              {additionalInfo.map((info, i) => (
                <div 
                  key={i} 
                  className={`p-1.5 border-b border-black last:border-b-0 font-bold ${
                    info.type === 'black' ? 'bg-black text-white' : 'bg-[#F2F2F2] text-black'
                  } ${info.italic ? 'italic' : ''}`}
                >
                  <input 
                      type="text" 
                      value={info.text} 
                      onChange={(e) => handleInfoChange(i, e.target.value)}
                      className={`w-full bg-transparent border-none focus:ring-0 p-0 m-0 ${
                          info.type === 'black' ? 'text-white placeholder-gray-400' : 'text-black placeholder-gray-500'
                      }`}
                      placeholder="Enter information here..."
                  />
                </div>
              ))}
            </div>
          </div>
          
          <div className="col-span-3 flex flex-col gap-4">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th colSpan={2} className="p-1 border border-black bg-black text-white font-bold">ONGOING TASKS</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="p-1.5 border border-black font-bold w-16">INT</td><td className="p-1.5 border border-black"></td></tr>
                <tr><td className="p-1.5 border border-black font-bold">DOM</td><td className="p-1.5 border border-black"></td></tr>
                <tr><td className="p-1.5 border border-black font-bold">ADHOC</td><td className="p-1.5 border border-black"></td></tr>
                <tr><td className="p-1.5 border border-black font-bold">VVIP</td><td className="p-1.5 border border-black"></td></tr>
              </tbody>
            </table>

            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="p-1 border border-black bg-black text-white font-bold">REMARKS</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="p-3 border border-black"></td></tr>
                <tr><td className="p-3 border border-black"></td></tr>
                <tr><td className="p-3 border border-black"></td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-3">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th colSpan={2} className="p-1 border border-black bg-black text-white font-bold">OUTGOING SHIFT</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="p-1 border border-black w-16">A-6102</td><td className="p-1 border border-black">SHINAAN</td></tr>
                <tr><td className="p-3 border border-black"></td><td className="p-3 border border-black"></td></tr>
              </tbody>
            </table>
          </div>
          <div className="col-span-6"></div>
          <div className="col-span-3">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th colSpan={2} className="p-1 border border-black bg-black text-white font-bold">INCOMING SHIFT</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="p-1 border border-black w-16">A-3162</td><td className="p-1 border border-black">SAM AAN</td></tr>
                <tr><td className="p-3 border border-black"></td><td className="p-3 border border-black"></td></tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};
