"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddPartnerButton() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [setupCommand, setSetupCommand] = useState("");
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: any) { e.preventDefault(); setLoading(true); setMsg(""); setSetupCommand("");
    const fd = new FormData(e.target); const body: any = {};
    fd.forEach((v,k) => { body[k]=v; });
    body.budgetMin = parseInt(body.budgetMin)||3000; body.budgetMax = parseInt(body.budgetMax)||500000;
    const res = await fetch("/api/admin/partners",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const d = await res.json();
    if (d.ok) {
      setMsg("✅ Партнёр создан!");
      if (d.setupCommand) setSetupCommand(d.setupCommand);
      router.refresh();
    } else {
      setMsg("❌ "+(d.error||"Ошибка"));
    }
    setLoading(false);
  }

  async function copyCommand() {
    await navigator.clipboard.writeText(setupCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const i: any = {width:"100%",padding:"8px 12px",borderRadius:"var(--radius-sm)",border:"1px solid var(--border)",background:"var(--bg-root)",color:"var(--ink-body)",fontSize:"var(--text-xs)",outline:"none",boxSizing:"border-box"};
  const t: any = {...i,minHeight:60,resize:"vertical"};
  const lbl: any = {fontSize:"var(--text-xs)",color:"var(--ink-muted)",marginBottom:4,display:"block"};
  const block: any = {padding:"14px 16px",borderRadius:"var(--radius-sm)",border:"1px solid var(--border)",marginBottom:12,background:"var(--bg-layer)"};
  const blockTitle: any = {fontWeight:650,fontSize:"var(--text-xs)",color:"var(--ink-heading)",marginBottom:10};

  if(!show) return <button onClick={()=>setShow(true)} style={{padding:"6px 14px",borderRadius:"var(--radius-sm)",background:"var(--accent)",color:"#fff",border:"none",fontWeight:600,fontSize:"var(--text-xs)",cursor:"pointer"}}>+ Добавить партнёра</button>;

  return (
    <tr><td colSpan={8} style={{padding:"16px 20px"}}>
      <form onSubmit={handleSubmit}>
        {/* Блок 1: Основное */}
        <div style={block}>
          <div style={blockTitle}>👤 Основное</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label style={lbl}>Email *</label><input name="email" type="email" required style={i} placeholder="partner@email.ru"/></div>
            <div><label style={lbl}>Имя</label><input name="name" style={i} placeholder="Иван"/></div>
            <div style={{gridColumn:"1/-1"}}><label style={lbl}>Пароль *</label><input name="password" type="text" required style={i} placeholder="Минимум 6 символов"/></div>
          </div>
        </div>

        {/* Блок 2: Profi.ru */}
        <div style={block}>
          <div style={blockTitle}>🔌 Profi.ru</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label style={lbl}>Логин Profi.ru</label><input name="profiLogin" style={i} placeholder="TimofeyevAG11"/></div>
            <div><label style={lbl}>Пароль Profi.ru</label><input name="profiPassword" type="password" style={i}/></div>
          </div>
        </div>

        {/* Блок 3: Фильтры */}
        <div style={block}>
          <div style={blockTitle}>🎯 Фильтры поиска</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label style={lbl}>Ключевые слова (через запятую)</label><textarea name="keywords" style={t} placeholder="сайт, лендинг, дизайн, разработка"/></div>
            <div><label style={lbl}>Минус-слова (через запятую)</label><textarea name="minusKeywords" style={t} placeholder="игры, 1с, бухгалтер"/></div>
            <div><label style={lbl}>Бюджет от (₽)</label><input name="budgetMin" type="number" defaultValue={3000} style={i}/></div>
            <div><label style={lbl}>Бюджет до (₽)</label><input name="budgetMax" type="number" defaultValue={500000} style={i}/></div>
          </div>
        </div>

        {/* Блок 4: Telegram */}
        <div style={block}>
          <div style={blockTitle}>📱 Telegram</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label style={lbl}>Chat ID (@getmyid_bot)</label><input name="telegramChatId" style={i} placeholder="778784292"/></div>
            <div><label style={lbl}>Bot Token (@BotFather)</label><input name="telegramToken" style={i} placeholder="123456:ABC-DEF..."/></div>
          </div>
        </div>

        {/* Кнопки */}
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button type="submit" disabled={loading} style={{padding:"10px 20px",borderRadius:"var(--radius-sm)",background:"var(--accent)",color:"#fff",border:"none",fontWeight:600,fontSize:"var(--text-sm)",cursor:"pointer"}}>{loading?"Создаю...":"✅ Создать партнёра"}</button>
          <button type="button" onClick={()=>setShow(false)} style={{padding:"10px 20px",background:"transparent",color:"var(--ink-muted)",border:"1px solid var(--border)",fontSize:"var(--text-sm)",cursor:"pointer"}}>Отмена</button>
          {msg&&<span style={{fontSize:"var(--text-xs)",color:msg.includes("✅")?"var(--green)":"var(--red)"}}>{msg}</span>}
        </div>

        {/* Setup-команда после создания */}
        {setupCommand && (
          <div style={{...block,background:"var(--accent-soft)",border:"1px solid var(--accent)",marginTop:16}}>
            <div style={blockTitle}>🚀 Команда для VPS партнёра</div>
            <p style={{fontSize:"var(--text-xs)",color:"var(--ink-muted)",marginBottom:8}}>Подключись к VPS и выполни:</p>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <code style={{flex:1,padding:"10px 14px",borderRadius:"var(--radius-sm)",background:"var(--bg-root)",border:"1px solid var(--border)",fontSize:"0.75rem",fontFamily:"monospace",wordBreak:"break-all"}}>{setupCommand}</code>
              <button type="button" onClick={copyCommand} style={{padding:"8px 14px",borderRadius:"var(--radius-sm)",background:copied?"var(--green)":"var(--accent)",color:"#fff",border:"none",fontWeight:600,fontSize:"var(--text-xs)",cursor:"pointer",whiteSpace:"nowrap"}}>{copied?"✅ Скопировано":"📋 Копировать"}</button>
            </div>
            <div style={{marginTop:8,fontSize:"0.65rem",color:"var(--ink-muted)"}}>
              <p>1. Подключись к VPS: <code style={{background:"var(--bg-root)",padding:"2px 6px",borderRadius:3}}>ssh root@IP_ПАРТНЁРА</code></p>
              <p>2. Выполни команду выше</p>
              <p>3. Проверь: <code style={{background:"var(--bg-root)",padding:"2px 6px",borderRadius:3}}>pm2 status</code> — должен быть leads-agent online</p>
            </div>
          </div>
        )}
      </form>
    </td></tr>
  );
}
