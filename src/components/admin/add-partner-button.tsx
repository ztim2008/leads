"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddPartnerButton() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const router = useRouter();

  async function handleSubmit(e: any) { e.preventDefault(); setLoading(true); setMsg("");
    const fd = new FormData(e.target); const body: any = {};
    fd.forEach((v,k) => { body[k]=v; });
    body.budgetMin = parseInt(body.budgetMin)||3000; body.budgetMax = parseInt(body.budgetMax)||500000;
    const res = await fetch("/api/admin/partners",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const d = await res.json();
    setMsg(d.ok ? "✅ Партнёр создан!" : "❌ "+(d.error||"Ошибка"));
    if(d.ok){setShow(false);router.refresh();}
    setLoading(false);
  }

  const inp: any = {width:"100%",padding:"8px 12px",borderRadius:"var(--radius-sm)",border:"1px solid var(--border)",background:"var(--bg-root)",color:"var(--ink-body)",fontSize:"var(--text-xs)",outline:"none",boxSizing:"border-box"};

  if(!show) return <button onClick={()=>setShow(true)} style={{padding:"6px 14px",borderRadius:"var(--radius-sm)",background:"var(--accent)",color:"#fff",border:"none",fontWeight:600,fontSize:"var(--text-xs)",cursor:"pointer"}}>+ Добавить партнёра</button>;

  return (<tr><td colSpan={8} style={{padding:"16px 20px"}}><form onSubmit={handleSubmit} style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
    <div><label style={{fontSize:"var(--text-xs)",color:"var(--ink-muted)"}}>Email *</label><input name="email" type="email" required style={inp} placeholder="partner@email.ru"/></div>
    <div><label style={{fontSize:"var(--text-xs)",color:"var(--ink-muted)"}}>Имя</label><input name="name" style={inp} placeholder="Иван"/></div>
    <div><label style={{fontSize:"var(--text-xs)",color:"var(--ink-muted)"}}>Пароль *</label><input name="password" type="text" required style={inp} placeholder="min 6"/></div>
    <div><label style={{fontSize:"var(--text-xs)",color:"var(--ink-muted)"}}>Profi логин</label><input name="profiLogin" style={inp}/></div>
    <div><label style={{fontSize:"var(--text-xs)",color:"var(--ink-muted)"}}>Profi пароль</label><input name="profiPassword" type="password" style={inp}/></div>
    <div><label style={{fontSize:"var(--text-xs)",color:"var(--ink-muted)"}}>Ключевые слова</label><input name="keywords" style={inp} placeholder="сайт, лендинг"/></div>
    <div><label style={{fontSize:"var(--text-xs)",color:"var(--ink-muted)"}}>Минус-слова</label><input name="minusKeywords" style={inp} placeholder="wordpress"/></div>
    <div><label style={{fontSize:"var(--text-xs)",color:"var(--ink-muted)"}}>Бюджет от</label><input name="budgetMin" type="number" defaultValue={3000} style={inp}/></div>
    <div><label style={{fontSize:"var(--text-xs)",color:"var(--ink-muted)"}}>Бюджет до</label><input name="budgetMax" type="number" defaultValue={500000} style={inp}/></div>
    <div><label style={{fontSize:"var(--text-xs)",color:"var(--ink-muted)"}}>Telegram Chat ID</label><input name="telegramChatId" style={inp}/></div>
    <div style={{gridColumn:"1/-1",display:"flex",gap:8,alignItems:"center"}}>
      <button type="submit" disabled={loading} style={{padding:"8px 16px",borderRadius:"var(--radius-sm)",background:"var(--accent)",color:"#fff",border:"none",fontWeight:600,fontSize:"var(--text-xs)",cursor:"pointer"}}>{loading?"Создаю...":"✅ Создать партнёра"}</button>
      <button type="button" onClick={()=>setShow(false)} style={{padding:"8px 16px",background:"transparent",color:"var(--ink-muted)",border:"1px solid var(--border)",fontSize:"var(--text-xs)",cursor:"pointer"}}>Отмена</button>
      {msg&&<span style={{fontSize:"var(--text-xs)",color:msg.includes("✅")?"var(--green)":"var(--red)"}}>{msg}</span>}
    </div>
  </form></td></tr>);
}
