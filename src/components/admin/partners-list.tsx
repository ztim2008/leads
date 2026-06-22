"use client";
import { useState, useEffect } from "react";

export default function PartnersList() {
  const [partners, setPartners] = useState<any[]>([]);

  useEffect(() => { fetch("/api/admin/partners").then(r=>r.json()).then(d=>setPartners(d.partners||[])).catch(()=>{}); }, []);

  async function loginAs(email: string) {
    window.open("/auth?email="+encodeURIComponent(email), "_blank");
  }

  if (partners.length === 0) return <p style={{padding:"20px",color:"var(--ink-muted)",fontSize:"var(--text-sm)",textAlign:"center"}}>Нет партнёров</p>;

  return (
    <table style={{width:"100%",borderCollapse:"collapse"}}>
      <thead><tr style={{borderBottom:"1px solid var(--border)"}}><th style={{padding:"10px 16px",textAlign:"left",fontSize:"var(--text-xs)",fontWeight:600,color:"var(--ink-muted)"}}>Партнёр</th><th style={{padding:"10px 16px",textAlign:"left",fontSize:"var(--text-xs)",fontWeight:600,color:"var(--ink-muted)"}}>Profi</th><th style={{padding:"10px 16px",textAlign:"left",fontSize:"var(--text-xs)",fontWeight:600,color:"var(--ink-muted)"}}>Заявок</th><th style={{padding:"10px 16px",textAlign:"left",fontSize:"var(--text-xs)",fontWeight:600,color:"var(--ink-muted)"}}>Tg</th><th style={{padding:"10px 16px"}}></th></tr></thead>
      <tbody>
        {partners.map((p:any) => {
          const ws = p.workspace;
          return (
            <tr key={p.id} style={{borderBottom:"1px solid var(--border-light)"}}>
              <td style={{padding:"10px 16px"}}><span style={{fontWeight:650,fontSize:"var(--text-sm)"}}>{p.name||p.email}</span><br/><span style={{fontSize:"var(--text-xs)",color:"var(--ink-muted)"}}>{p.email}</span></td>
              <td style={{padding:"10px 16px",fontSize:"var(--text-xs)"}}>{ws?.sources?.some((s:any)=>s.platform==="profi"&&s.enabled)?"✅":"❌"}</td>
              <td style={{padding:"10px 16px",fontSize:"var(--text-sm)",fontWeight:600}}>{ws?.leadsCount||0}</td>
              <td style={{padding:"10px 16px",fontSize:"var(--text-xs)"}}>{ws?.settings?.telegramChatId?"✅":"—"}</td>
              <td style={{padding:"10px 16px"}}><div style={{display:"flex",gap:4}}><button onClick={()=>loginAs(p.email)} style={{padding:"4px 10px",borderRadius:"var(--radius-sm)",background:"var(--accent-soft)",color:"var(--accent)",border:"1px solid var(--accent)",fontSize:"var(--text-xs)",fontWeight:600,cursor:"pointer"}}>🔑 Войти как</button><button onClick={async()=>{if(!confirm("Пометить оплату на 30 дней?"))return;await fetch("/api/admin/mark-paid",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:p.email})});alert("✅ Отмечено");}} style={{padding:"4px 10px",borderRadius:"var(--radius-sm)",background:"var(--green-soft)",color:"var(--green)",border:"1px solid var(--green)",fontSize:"var(--text-xs)",fontWeight:600,cursor:"pointer"}}>💰 Оплатил</button></div></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
