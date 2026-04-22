import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { db } from "./supabase.js";

const COLORS = ["#FF6B6B","#FFD93D","#6BCB77","#4D96FF","#C77DFF","#FF9F1C","#2EC4B6","#E71D36"];
const CATEGORIES = ["✈️ Travel","🍔 Food","🏨 Stay","🎡 Activity","🛒 Shopping","⛽ Fuel","🎟️ Tickets","💊 Medical","📦 Other"];
const TRIP_COVERS = ["🏖️","🏔️","🌴","🗼","🏕️","🎡","🚢","🏛️","🌋","🎭","🏝️","🚂"];

/* ── helpers ── */
function Avatar({ name, color, size=40 }) {
  return <div style={{ width:size,height:size,borderRadius:"50%",background:color,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:size*0.38,color:"#fff",flexShrink:0,boxShadow:`0 2px 8px ${color}55`,fontFamily:"'Outfit',sans-serif" }}>{name.trim().charAt(0).toUpperCase()}</div>;
}
function Modal({ children, onClose, wide }) {
  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(10,10,20,0.88)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(8px)",padding:"1rem" }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#1c1635",borderRadius:20,padding:"1.8rem",width:"100%",maxWidth:wide?520:440,boxShadow:"0 24px 64px rgba(0,0,0,0.7)",border:"1px solid rgba(124,58,237,0.2)",maxHeight:"92vh",overflowY:"auto" }}>{children}</div>
    </div>
  );
}
function Tag({ label, color }) {
  return <span style={{ background:color+"22",color,border:`1px solid ${color}44`,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:600,fontFamily:"'Outfit',sans-serif" }}>{label}</span>;
}
function Toast({ toast }) {
  if (!toast) return null;
  return <div style={{ position:"fixed",top:24,left:"50%",transform:"translateX(-50%)",background:toast.type==="error"?"#FF6B6B":toast.type==="info"?"#4D96FF":"#6BCB77",color:"#fff",padding:"0.6rem 1.5rem",borderRadius:30,fontWeight:700,fontSize:14,zIndex:9999,boxShadow:"0 8px 24px rgba(0,0,0,0.4)",whiteSpace:"nowrap",fontFamily:"'Outfit',sans-serif" }}>{toast.msg}</div>;
}
function Spinner() {
  return <div style={{ width:20,height:20,border:"2px solid rgba(255,255,255,0.1)",borderTop:"2px solid #7C3AED",borderRadius:"50%",animation:"spin 0.7s linear infinite",flexShrink:0 }}/>;
}
function SplitifyLogo({ size=36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r="50" fill="url(#slg)"/>
      <path d="M50 5 A45 45 0 0 1 95 50 L50 50 Z" fill="url(#sgr)"/>
      <path d="M50 5 A45 45 0 0 0 5 50 L50 50 Z" fill="url(#spu)"/>
      <path d="M50 50 L5 50 A45 45 0 0 0 50 95 Z" fill="url(#spu2)"/>
      <path d="M50 50 L95 50 A45 45 0 0 1 50 95 Z" fill="url(#sgr2)"/>
      <text x="50" y="63" textAnchor="middle" fontSize="40" fontWeight="900" fill="white" fontFamily="Arial">S</text>
      <text x="29" y="56" textAnchor="middle" fontSize="13" fill="white">→</text>
      <text x="71" y="56" textAnchor="middle" fontSize="13" fill="white">←</text>
      <defs>
        <linearGradient id="spu" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#7C3AED"/><stop offset="1" stopColor="#6366F1"/></linearGradient>
        <linearGradient id="spu2" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#6366F1"/><stop offset="1" stopColor="#4F46E5"/></linearGradient>
        <linearGradient id="sgr" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#10B981"/><stop offset="1" stopColor="#34D399"/></linearGradient>
        <linearGradient id="sgr2" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#34D399"/><stop offset="1" stopColor="#6EE7B7"/></linearGradient>
        <linearGradient id="slg" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#7C3AED"/><stop offset="1" stopColor="#10B981"/></linearGradient>
      </defs>
    </svg>
  );
}

/* ── SYNC STATUS badge ── */
function SyncBadge({ synced }) {
  return (
    <div style={{ display:"flex",alignItems:"center",gap:4,background:synced?"rgba(16,185,129,0.1)":"rgba(255,193,7,0.1)",border:`1px solid ${synced?"rgba(16,185,129,0.3)":"rgba(255,193,7,0.3)"}`,borderRadius:20,padding:"2px 8px" }}>
      <div style={{ width:6,height:6,borderRadius:"50%",background:synced?"#10B981":"#FFC107",animation:synced?"none":"pulse 1.5s infinite" }}/>
      <span style={{ fontSize:10,fontWeight:700,color:synced?"#10B981":"#FFC107" }}>{synced?"LIVE":"SYNCING"}</span>
    </div>
  );
}

/* ── RECEIPT SCANNER ── */
function ReceiptScanner({ onExtracted, onClose }) {
  const [scanning,setScanning]=useState(false);
  const [preview,setPreview]=useState(null);
  const [result,setResult]=useState(null);
  const [dragOver,setDragOver]=useState(false);
  const fileRef=useRef();
  const processFile=async(file)=>{
    if(!file||!file.type.startsWith("image/")) return;
    const reader=new FileReader();
    reader.onload=async(e)=>{
      const b64=e.target.result.split(",")[1]; const mt=file.type;
      setPreview(e.target.result); setScanning(true); setResult(null);
      try {
        const res=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:[{type:"image",source:{type:"base64",media_type:mt,data:b64}},{type:"text",text:`Extract receipt data. Respond ONLY with JSON, no markdown:\n{"total":0.00,"date":"DD/MM/YYYY","description":"merchant + items max 40 chars","items":[{"name":"...","amount":0.00}]}`}]}]})});
        const data=await res.json();
        const raw=data.content?.find(b=>b.type==="text")?.text||"{}";
        setResult(JSON.parse(raw.replace(/```json|```/g,"").trim()));
      } catch { setResult({error:true}); }
      setScanning(false);
    };
    reader.readAsDataURL(file);
  };
  return (
    <Modal onClose={onClose} wide>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.2rem" }}>
        <h2 style={{ margin:0,fontWeight:800,fontSize:20 }}>🧾 AI Receipt Scanner</h2>
        <button onClick={onClose} style={{ background:"none",border:"none",color:"#555",fontSize:22,cursor:"pointer" }}>×</button>
      </div>
      {!preview&&(
        <div onDrop={e=>{e.preventDefault();setDragOver(false);processFile(e.dataTransfer.files[0]);}} onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)} onClick={()=>fileRef.current.click()}
          style={{ border:`2px dashed ${dragOver?"#7C3AED":"rgba(255,255,255,0.15)"}`,borderRadius:16,padding:"2.5rem 1rem",textAlign:"center",cursor:"pointer",background:dragOver?"rgba(124,58,237,0.06)":"rgba(255,255,255,0.02)",transition:"all 0.2s" }}>
          <div style={{ fontSize:48,marginBottom:"0.6rem" }}>📷</div>
          <div style={{ fontWeight:700,fontSize:15,color:"#ccc" }}>Drop receipt image here</div>
          <div style={{ fontSize:13,color:"#555",marginTop:4 }}>or click to upload</div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={e=>processFile(e.target.files[0])}/>
        </div>
      )}
      {preview&&(
        <div style={{ display:"flex",gap:"1rem",flexWrap:"wrap" }}>
          <img src={preview} alt="receipt" style={{ width:150,height:190,objectFit:"cover",borderRadius:12,border:"1px solid rgba(255,255,255,0.1)",flexShrink:0 }}/>
          <div style={{ flex:1,minWidth:160 }}>
            {scanning&&<div style={{ textAlign:"center",padding:"2rem 0" }}><div style={{ fontSize:32 }}>🔍</div><div style={{ color:"#7C3AED",fontWeight:700,fontSize:14,marginTop:8 }}>Scanning…</div></div>}
            {result&&!result.error&&(
              <div>
                <div style={{ fontSize:12,color:"#6BCB77",fontWeight:700,marginBottom:"0.8rem" }}>✅ Extracted!</div>
                <div style={{ background:"rgba(107,203,119,0.07)",border:"1px solid rgba(107,203,119,0.2)",borderRadius:12,padding:"0.9rem" }}>
                  {[["Description",result.description],["Total",`₹${parseFloat(result.total||0).toFixed(2)}`],["Date",result.date]].map(([l,v])=>(
                    <div key={l} style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                      <span style={{ fontSize:11,color:"#555",fontWeight:600,textTransform:"uppercase" }}>{l}</span>
                      <span style={{ fontSize:l==="Total"?16:13,fontWeight:l==="Total"?800:600,color:l==="Total"?"#FFD93D":"#ccc" }}>{v}</span>
                    </div>
                  ))}
                  {result.items?.length>0&&<div style={{ marginTop:"0.6rem" }}>{result.items.map((it,i)=><div key={i} style={{ display:"flex",justifyContent:"space-between",fontSize:12,color:"#aaa",padding:"2px 0" }}><span>{it.name}</span><span style={{ color:"#FFD93D" }}>₹{parseFloat(it.amount||0).toFixed(2)}</span></div>)}</div>}
                </div>
                <div style={{ display:"flex",gap:8,marginTop:"1rem" }}>
                  <button onClick={()=>{setPreview(null);setResult(null);}} style={{ flex:1,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",color:"#777",borderRadius:10,padding:"0.6rem",fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer" }}>Re-scan</button>
                  <button onClick={()=>onExtracted(result)} style={{ flex:2,background:"#6BCB77",border:"none",color:"#fff",borderRadius:10,padding:"0.6rem",fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer" }}>Use This →</button>
                </div>
              </div>
            )}
            {result?.error&&<div style={{ textAlign:"center",padding:"1.5rem 0" }}><div style={{ fontSize:32 }}>😕</div><div style={{ color:"#FF6B6B",fontWeight:700,marginTop:8 }}>Couldn't read receipt</div><button onClick={()=>{setPreview(null);setResult(null);}} style={{ marginTop:"0.8rem",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",color:"#aaa",borderRadius:10,padding:"0.5rem 1rem",fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer" }}>Try again</button></div>}
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ── PAYMENT MODAL ── */
function PaymentModal({ txn,debtorM,creditorM,onClose,onPayment }) {
  const [amount,setAmount]=useState(txn.amount.toFixed(2));
  const [mode,setMode]=useState("full");
  const [saving,setSaving]=useState(false);
  const handlePay=async()=>{
    const amt=parseFloat(amount); if(isNaN(amt)||amt<=0||amt>txn.amount+0.01) return;
    setSaving(true); await onPayment(txn,Math.min(amt,txn.amount)); setSaving(false); onClose();
  };
  return (
    <Modal onClose={onClose}>
      <h2 style={{ margin:"0 0 1.2rem",fontWeight:800,fontSize:19 }}>💳 Record Payment</h2>
      <div style={{ display:"flex",alignItems:"center",gap:10,background:"rgba(124,58,237,0.08)",borderRadius:12,padding:"0.9rem",marginBottom:"1.2rem" }}>
        <Avatar name={debtorM.name} color={debtorM.color} size={36}/>
        <div style={{ flex:1,fontSize:13,color:"#bbb" }}><span style={{ color:debtorM.color,fontWeight:700 }}>{debtorM.name}</span> pays <span style={{ color:creditorM.color,fontWeight:700 }}>{creditorM.name}</span></div>
        <div style={{ fontWeight:800,fontSize:17,color:"#FFD93D" }}>₹{txn.amount.toFixed(2)}</div>
      </div>
      <div style={{ display:"flex",gap:8,marginBottom:"1rem" }}>
        {["full","partial"].map(m=>(
          <button key={m} onClick={()=>{setMode(m);if(m==="full") setAmount(txn.amount.toFixed(2));}} style={{ flex:1,background:mode===m?"rgba(124,58,237,0.2)":"rgba(255,255,255,0.04)",border:`1.5px solid ${mode===m?"#7C3AED":"rgba(255,255,255,0.1)"}`,color:mode===m?"#a78bfa":"#666",borderRadius:10,padding:"0.55rem",fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer" }}>
            {m==="full"?"✅ Full Payment":"⚡ Partial"}
          </button>
        ))}
      </div>
      {mode==="partial"&&(
        <div style={{ marginBottom:"1rem" }}>
          <label style={{ fontSize:11,color:"#555",fontWeight:700,display:"block",marginBottom:6,textTransform:"uppercase" }}>Amount Paying (₹)</label>
          <input value={amount} onChange={e=>setAmount(e.target.value)} type="number" max={txn.amount} style={{ width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,padding:"0.7rem 0.9rem",color:"#fff",fontFamily:"'Outfit',sans-serif",fontSize:15,outline:"none",boxSizing:"border-box" }}/>
          {parseFloat(amount)<txn.amount&&parseFloat(amount)>0&&<div style={{ fontSize:12,color:"#FFD93D",marginTop:5,fontWeight:600 }}>Remaining: ₹{(txn.amount-parseFloat(amount)).toFixed(2)}</div>}
        </div>
      )}
      <div style={{ display:"flex",gap:10,marginTop:"0.5rem" }}>
        <button onClick={onClose} style={{ flex:1,background:"rgba(124,58,237,0.1)",border:"1px solid rgba(124,58,237,0.2)",color:"#a78bfa",borderRadius:12,padding:"0.7rem",fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer" }}>Cancel</button>
        <button onClick={handlePay} disabled={saving} style={{ flex:2,background:"linear-gradient(135deg,#7C3AED,#10B981)",border:"none",color:"#fff",borderRadius:12,padding:"0.7rem",fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
          {saving?<Spinner/>:null} {saving?"Saving…":"Mark Paid ✓"}
        </button>
      </div>
    </Modal>
  );
}

/* ── CHAT TAB ── */
function ChatTab({ members,tripName,expenses }) {
  const [messages,setMessages]=useState([
    {id:1,type:"system",text:`👋 Welcome to the ${tripName} group chat!`},
    {id:2,type:"ai",text:"Hey everyone! 🎉 I'm your trip assistant. Ask me about expenses, splitting, or trip plans!",time:new Date()}
  ]);
  const [activeMember,setActiveMember]=useState(null);
  const [input,setInput]=useState("");
  const [sending,setSending]=useState(false);
  const [showHint,setShowHint]=useState(false);
  const bottomRef=useRef(null);
  const inputRef=useRef(null);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[messages,sending]);
  const fmt=d=>d?d.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}):"";
  const sendMessage=async()=>{
    if(!activeMember){setShowHint(true);return;}
    const text=input.trim(); if(!text||sending) return;
    setShowHint(false);
    setMessages(p=>[...p,{id:Date.now(),type:"user",memberId:activeMember.id,memberName:activeMember.name,memberColor:activeMember.color,text,time:new Date()}]);
    setInput(""); setSending(true);
    const ml=members.map(m=>m.name).join(", ");
    const es=expenses.length?expenses.map(e=>{const p=members.find(m=>m.id===e.paid_by||m.id===e.paidBy);return `${e.desc||e.description} ₹${e.amount} paid by ${p?.name}`;}).join("; "):"No expenses yet";
    const sys=`You are a fun group chat assistant for trip "${tripName}". Members: ${ml}. Expenses: ${es}. Keep replies SHORT (1-3 sentences), casual, use emojis. Be a helpful travel buddy.`;
    const hist=messages.filter(m=>m.type==="user"||m.type==="ai").slice(-12).map(m=>({role:m.type==="ai"?"assistant":"user",content:m.type==="user"?`[${m.memberName}]: ${m.text}`:m.text}));
    try {
      const res=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:sys,messages:[...hist,{role:"user",content:`[${activeMember.name}]: ${text}`}]})});
      const data=await res.json();
      setMessages(p=>[...p,{id:Date.now()+1,type:"ai",text:data.content?.find(b=>b.type==="text")?.text||"...",time:new Date()}]);
    } catch { setMessages(p=>[...p,{id:Date.now()+1,type:"ai",text:"Couldn't connect! 😅",time:new Date()}]); }
    setSending(false); setTimeout(()=>inputRef.current?.focus(),50);
  };
  return (
    <div style={{ display:"flex",flexDirection:"column",flex:1,overflow:"hidden" }}>
      <div style={{ background:"rgba(124,58,237,0.08)",borderBottom:"1px solid rgba(124,58,237,0.2)",padding:"0.55rem 1rem",display:"flex",alignItems:"center",gap:8,flexShrink:0,flexWrap:"wrap" }}>
        <span style={{ fontSize:11,color:"#555",fontWeight:700,whiteSpace:"nowrap",textTransform:"uppercase",letterSpacing:0.8 }}>You are:</span>
        {members.length===0?<span style={{ fontSize:12,color:"#444" }}>Add members first</span>
          :members.map(m=>(
            <button key={m.id} onClick={()=>{setActiveMember(m);setShowHint(false);}} style={{ display:"flex",alignItems:"center",gap:5,background:activeMember?.id===m.id?m.color+"2a":"rgba(255,255,255,0.04)",border:`1.5px solid ${activeMember?.id===m.id?m.color:"rgba(255,255,255,0.07)"}`,color:activeMember?.id===m.id?m.color:"#666",borderRadius:20,padding:"3px 10px 3px 5px",fontSize:12,cursor:"pointer",fontFamily:"'Outfit',sans-serif",fontWeight:600 }}>
              <Avatar name={m.name} color={m.color} size={20}/>{m.name}
            </button>
          ))}
      </div>
      {showHint&&<div style={{ background:"rgba(255,107,107,0.08)",borderBottom:"1px solid rgba(255,107,107,0.15)",padding:"0.4rem 1rem",fontSize:12,color:"#FF6B6B",fontWeight:600,flexShrink:0 }}>👆 Pick who you are before sending!</div>}
      <div style={{ flex:1,overflowY:"auto",padding:"1rem",display:"flex",flexDirection:"column",gap:10 }}>
        {messages.map(msg=>{
          if(msg.type==="system") return <div key={msg.id} style={{ textAlign:"center" }}><span style={{ background:"rgba(255,255,255,0.05)",borderRadius:20,padding:"4px 16px",fontSize:12,color:"#555",fontWeight:500 }}>{msg.text}</span></div>;
          if(msg.type==="ai") return (
            <div key={msg.id} style={{ display:"flex",gap:8,alignItems:"flex-end",maxWidth:"85%" }}>
              <div style={{ width:34,height:34,borderRadius:"50%",background:"linear-gradient(135deg,#7C3AED,#10B981)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0 }}>🤖</div>
              <div><div style={{ fontSize:10,color:"#444",marginBottom:3,fontWeight:600 }}>Trip Bot · {fmt(msg.time)}</div><div style={{ background:"linear-gradient(135deg,rgba(124,58,237,0.1),rgba(16,185,129,0.1))",border:"1px solid rgba(124,58,237,0.2)",borderRadius:"4px 16px 16px 16px",padding:"0.65rem 0.95rem",fontSize:14,color:"#d8d8ee",lineHeight:1.55 }}>{msg.text}</div></div>
            </div>
          );
          const isMe=msg.memberId===activeMember?.id;
          return (
            <div key={msg.id} style={{ display:"flex",gap:8,alignItems:"flex-end",maxWidth:"85%",alignSelf:isMe?"flex-end":"flex-start",flexDirection:isMe?"row-reverse":"row" }}>
              <Avatar name={msg.memberName} color={msg.memberColor} size={30}/>
              <div style={{ display:"flex",flexDirection:"column",alignItems:isMe?"flex-end":"flex-start" }}>
                {!isMe&&<div style={{ fontSize:10,color:msg.memberColor,marginBottom:3,fontWeight:700 }}>{msg.memberName}</div>}
                <div style={{ background:isMe?msg.memberColor+"28":"rgba(255,255,255,0.06)",border:`1px solid ${isMe?msg.memberColor+"40":"rgba(255,255,255,0.07)"}`,borderRadius:isMe?"16px 4px 16px 16px":"4px 16px 16px 16px",padding:"0.6rem 0.9rem",fontSize:14,color:"#dde",lineHeight:1.5,wordBreak:"break-word" }}>{msg.text}</div>
                <div style={{ fontSize:10,color:"#3a3a4a",marginTop:3 }}>{fmt(msg.time)}</div>
              </div>
            </div>
          );
        })}
        {sending&&<div style={{ display:"flex",gap:8,alignItems:"flex-end" }}><div style={{ width:34,height:34,borderRadius:"50%",background:"linear-gradient(135deg,#7C3AED,#10B981)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0 }}>🤖</div><div style={{ background:"rgba(124,58,237,0.08)",border:"1px solid rgba(124,58,237,0.15)",borderRadius:"4px 16px 16px 16px",padding:"0.75rem 1.1rem" }}><div style={{ display:"flex",gap:5,alignItems:"center" }}>{[0,1,2].map(i=><div key={i} style={{ width:6,height:6,borderRadius:"50%",background:"#7C3AED",animation:"bonce 1.2s infinite",animationDelay:`${i*0.2}s` }}/>)}</div></div></div>}
        <div ref={bottomRef}/>
      </div>
      <div style={{ borderTop:"1px solid rgba(255,255,255,0.06)",padding:"0.75rem 1rem",display:"flex",gap:8,alignItems:"center",background:"#0e0b1e",flexShrink:0 }}>
        {activeMember&&<Avatar name={activeMember.name} color={activeMember.color} size={26}/>}
        <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}}} placeholder={activeMember?`Message as ${activeMember.name}…`:"Select who you are above…"} style={{ flex:1,background:"rgba(124,58,237,0.1)",border:"1px solid rgba(124,58,237,0.25)",borderRadius:22,padding:"0.6rem 1rem",color:"#eee",fontFamily:"'Outfit',sans-serif",fontSize:14,outline:"none" }}/>
        <button onClick={sendMessage} disabled={sending||!input.trim()} style={{ width:42,height:42,borderRadius:"50%",border:"none",cursor:"pointer",flexShrink:0,background:(!sending&&input.trim())?"linear-gradient(135deg,#7C3AED,#10B981)":"rgba(124,58,237,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:"#fff" }}>➤</button>
      </div>
      <style>{`@keyframes bonce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}} @keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );
}

/* ══════════════════════════════════════
   TRIP DETAIL
══════════════════════════════════════ */
function TripDetail({ trip, onBack, showToast }) {
  const [members,setMembers]=useState([]);
  const [expenses,setExpenses]=useState([]);
  const [payments,setPayments]=useState([]);
  const [loading,setLoading]=useState(true);
  const [synced,setSynced]=useState(false);
  const [tab,setTab]=useState("members");
  const [showAddMember,setShowAddMember]=useState(false);
  const [showAddExpense,setShowAddExpense]=useState(false);
  const [showScanner,setShowScanner]=useState(false);
  const [paymentModal,setPaymentModal]=useState(null);
  const [memberForm,setMemberForm]=useState({name:"",whatsapp:""});
  const [expenseForm,setExpenseForm]=useState({desc:"",amount:"",paid_by:"",category:CATEGORIES[0],split_among:[],date:""});
  const [savingExp,setSavingExp]=useState(false);
  const [savingMem,setSavingMem]=useState(false);

  // Load data from Supabase
  const loadAll=useCallback(async()=>{
    setLoading(true);
    const [m,e,p]=await Promise.all([db.getMembers(trip.id),db.getExpenses(trip.id),db.getPayments(trip.id)]);
    setMembers(m||[]); setExpenses(e||[]); setPayments(p||[]);
    setLoading(false); setSynced(true);
  },[trip.id]);

  useEffect(()=>{
    loadAll();
    // Subscribe to real-time changes
    const unsubs=[
      db.subscribe("members",trip.id,(evt,rec,old)=>{
        if(evt==="INSERT") setMembers(p=>[...p,rec]);
        if(evt==="DELETE") setMembers(p=>p.filter(m=>m.id!==old?.id));
        setSynced(true);
      }),
      db.subscribe("expenses",trip.id,(evt,rec,old)=>{
        if(evt==="INSERT") setExpenses(p=>[...p,rec]);
        if(evt==="DELETE") setExpenses(p=>p.filter(e=>e.id!==old?.id));
        setSynced(true);
      }),
      db.subscribe("payments",trip.id,(evt,rec)=>{
        if(evt==="INSERT") setPayments(p=>[...p,rec]);
        setSynced(true);
      }),
    ];
    return ()=>unsubs.forEach(u=>u());
  },[trip.id,loadAll]);

  const getM=id=>members.find(m=>m.id===id);

  const addMember=async()=>{
    if(!memberForm.name.trim()) return;
    setSavingMem(true);
    const color=COLORS[members.length%COLORS.length];
    const result=await db.addMember({trip_id:trip.id,name:memberForm.name.trim(),whatsapp:memberForm.whatsapp.trim(),color});
    if(result) { setMembers(p=>[...p,...(Array.isArray(result)?result:[result])]); showToast(`${memberForm.name.trim()} added! 👋`); }
    else showToast("Failed to add member","error");
    setMemberForm({name:"",whatsapp:""}); setShowAddMember(false); setSavingMem(false);
  };

  const removeMember=async(id)=>{
    await db.deleteMember(id);
    setMembers(p=>p.filter(m=>m.id!==id));
  };

  const openAddExpense=(prefill)=>{
    if(members.length<2){showToast("Add at least 2 members first!","error");return;}
    setExpenseForm({desc:prefill?.description||"",amount:prefill?.total||"",paid_by:members[0].id,category:CATEGORIES[0],split_among:members.map(m=>m.id),date:prefill?.date||new Date().toLocaleDateString("en-IN")});
    setShowAddExpense(true);
  };

  const addExpense=async()=>{
    const amt=parseFloat(expenseForm.amount);
    if(!expenseForm.desc.trim()||isNaN(amt)||amt<=0){showToast("Fill all fields!","error");return;}
    if(!expenseForm.paid_by){showToast("Select who paid!","error");return;}
    if(expenseForm.split_among.length===0){showToast("Select at least 1 person!","error");return;}
    setSavingExp(true);
    const result=await db.addExpense({trip_id:trip.id,desc:expenseForm.desc.trim(),amount:amt,paid_by:expenseForm.paid_by,category:expenseForm.category,split_among:expenseForm.split_among,date:expenseForm.date||new Date().toLocaleDateString("en-IN")});
    if(result){setExpenses(p=>[...p,...(Array.isArray(result)?result:[result])]);showToast("Expense added! 💸");}
    else showToast("Failed to add expense","error");
    setShowAddExpense(false); setSavingExp(false);
  };

  const deleteExpense=async(id)=>{
    await db.deleteExpense(id);
    setExpenses(p=>p.filter(e=>e.id!==id));
    showToast("Expense deleted");
  };

  const toggleSplit=id=>setExpenseForm(f=>({...f,split_among:f.split_among.includes(id)?f.split_among.filter(s=>s!==id):[...f.split_among,id]}));

  const recordPayment=async(txn,amount)=>{
    const result=await db.addPayment({trip_id:trip.id,txn_key:txn.key,from_id:txn.from,to_id:txn.to,amount,date:new Date().toLocaleDateString("en-IN")});
    if(result){setPayments(p=>[...p,...(Array.isArray(result)?result:[result])]);showToast(`₹${amount.toFixed(2)} payment recorded! ✅`);}
    else showToast("Failed to record payment","error");
  };

  const settlements=useMemo(()=>{
    const memberSpend={};
    members.forEach(m=>memberSpend[m.id]={paid:0,share:0});
    expenses.forEach(exp=>{
      const paidBy=exp.paid_by||exp.paidBy;
      const splitAmong=exp.split_among||exp.splitAmong||[];
      if(memberSpend[paidBy]) memberSpend[paidBy].paid+=parseFloat(exp.amount);
      const share=parseFloat(exp.amount)/splitAmong.length;
      splitAmong.forEach(pid=>{if(memberSpend[pid]) memberSpend[pid].share+=share;});
    });
    const debtMap={};
    members.forEach(m=>{debtMap[m.id]={};members.forEach(n=>{debtMap[m.id][n.id]=0;});});
    expenses.forEach(exp=>{
      const paidBy=exp.paid_by||exp.paidBy;
      const splitAmong=exp.split_among||exp.splitAmong||[];
      const share=parseFloat(exp.amount)/splitAmong.length;
      splitAmong.forEach(pid=>{if(pid!==paidBy&&debtMap[pid]?.[paidBy]!==undefined) debtMap[pid][paidBy]+=share;});
    });
    payments.forEach(pmt=>{
      const fi=pmt.from_id,ti=pmt.to_id;
      if(debtMap[fi]?.[ti]!==undefined) debtMap[fi][ti]=Math.max(0,debtMap[fi][ti]-parseFloat(pmt.amount));
    });
    const txns=[]; const visited=new Set();
    members.forEach(m=>{members.forEach(n=>{
      if(m.id===n.id) return;
      const key=[m.id,n.id].sort().join("-"); if(visited.has(key)) return; visited.add(key);
      const mOwesN=debtMap[m.id]?.[n.id]||0,nOwesM=debtMap[n.id]?.[m.id]||0,net=mOwesN-nOwesM;
      if(net>0.01) txns.push({from:m.id,to:n.id,amount:net,key:`${m.id}-${n.id}`});
      else if(net<-0.01) txns.push({from:n.id,to:m.id,amount:-net,key:`${n.id}-${m.id}`});
    });});
    const balance={};
    members.forEach(m=>balance[m.id]=(memberSpend[m.id]?.paid||0)-(memberSpend[m.id]?.share||0));
    return {txns,balance,memberSpend};
  },[expenses,members,payments]);

  const waLink=(dm,cm,amount)=>{
    const msg=`Hi ${dm.name}! 👋 Reminder for *${trip.name}*: You owe *₹${amount.toFixed(2)}* to *${cm.name}*. Please settle up! 🙏`;
    return `https://wa.me/${dm.whatsapp.replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`;
  };
  const total=expenses.reduce((a,e)=>a+parseFloat(e.amount),0);

  const iStyle={width:"100%",background:"rgba(124,58,237,0.08)",border:"1px solid rgba(124,58,237,0.25)",borderRadius:10,padding:"0.7rem 0.9rem",color:"#fff",fontFamily:"'Outfit',sans-serif",fontSize:15,outline:"none",boxSizing:"border-box"};
  const lStyle={fontSize:11,color:"#555",fontWeight:700,display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:0.9};
  const NavBtn=({id,label,icon})=>(
    <button onClick={()=>setTab(id)} style={{ flex:1,padding:"0.55rem 0",border:"none",cursor:"pointer",background:tab===id?"linear-gradient(135deg,#7C3AED,#10B981)":"transparent",color:tab===id?"#fff":"#9d8fc0",borderRadius:10,fontFamily:"'Outfit',sans-serif",fontSize:11,fontWeight:700,transition:"all 0.2s",display:"flex",flexDirection:"column",alignItems:"center",gap:2 }}>
      <span style={{ fontSize:18 }}>{icon}</span>{label}
    </button>
  );

  if(loading) return (
    <div style={{ width:"100%",maxWidth:480,height:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16 }}>
      <Spinner/>
      <div style={{ fontSize:14,color:"#555",fontWeight:600 }}>Loading trip data…</div>
    </div>
  );

  return (
    <div style={{ width:"100%",maxWidth:480,display:"flex",flexDirection:"column",height:"100vh" }}>
      {/* Header */}
      <div style={{ background:"linear-gradient(145deg,#1a0e3a 0%,#16083a 40%,#0a2a1a 100%)",padding:"1rem 1.4rem",borderBottom:"1px solid rgba(124,58,237,0.25)",flexShrink:0 }}>
        <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:10 }}>
          <button onClick={onBack} style={{ background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",color:"#c4b8e8",borderRadius:10,width:34,height:34,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>←</button>
          <span style={{ fontSize:24 }}>{trip.cover}</span>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:"'Poppins',sans-serif",fontWeight:800,fontSize:18,color:"#e8e0ff",lineHeight:1.2 }}>{trip.name}</div>
            <div style={{ fontSize:11,color:"#7a6f9a",marginTop:2 }}>{trip.date}</div>
          </div>
          <SyncBadge synced={synced}/>
        </div>
        <div style={{ display:"flex",gap:8 }}>
          {[{l:"TOTAL",v:`₹${total.toLocaleString("en-IN",{maximumFractionDigits:0})}`,c:"#a78bfa"},{l:"MEMBERS",v:members.length,c:"#10B981"},{l:"EXPENSES",v:expenses.length,c:"#F59E0B"}].map(s=>(
            <div key={s.l} style={{ background:s.c+"14",borderRadius:10,padding:"0.4rem 0.8rem",border:`1px solid ${s.c}28`,flex:1 }}>
              <div style={{ fontSize:9,color:"#555",fontWeight:700,textTransform:"uppercase",letterSpacing:0.8 }}>{s.l}</div>
              <div style={{ fontSize:18,fontWeight:800,color:s.c }}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex:1,overflow:tab==="chat"?"hidden":"auto",display:"flex",flexDirection:"column" }}>
        {/* MEMBERS */}
        {tab==="members"&&(
          <div style={{ padding:"1rem 1.2rem" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem" }}>
              <h2 style={{ margin:0,fontSize:14,fontWeight:700,color:"#a89fc8",textTransform:"uppercase",letterSpacing:1 }}>👥 Members</h2>
              <button onClick={()=>setShowAddMember(true)} style={{ background:"linear-gradient(135deg,#7C3AED,#6366F1)",border:"none",color:"#fff",padding:"0.4rem 1rem",borderRadius:20,fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer" }}>+ Add</button>
            </div>
            {members.length===0?(
              <div style={{ textAlign:"center",padding:"3rem 1rem",color:"#444" }}><div style={{ fontSize:52 }}>👥</div><div style={{ fontWeight:600,marginTop:10 }}>No members yet</div><div style={{ fontSize:13,marginTop:4 }}>Add your travel buddies</div></div>
            ):members.map(m=>(
              <div key={m.id} style={{ background:"#1c1635",borderRadius:14,padding:"0.9rem 1rem",marginBottom:"0.7rem",display:"flex",alignItems:"center",gap:12,border:"1px solid rgba(124,58,237,0.15)" }}>
                <Avatar name={m.name} color={m.color}/>
                <div style={{ flex:1 }}><div style={{ fontWeight:700,fontSize:15 }}>{m.name}</div>{m.whatsapp&&<div style={{ fontSize:12,color:"#6BCB77",marginTop:2 }}>📱 {m.whatsapp}</div>}</div>
                <div style={{ textAlign:"right",marginRight:6 }}><div style={{ fontSize:10,color:"#444" }}>Paid</div><div style={{ fontWeight:700,color:"#a78bfa",fontSize:14 }}>₹{(settlements.memberSpend[m.id]?.paid||0).toFixed(0)}</div></div>
                <button onClick={()=>removeMember(m.id)} style={{ background:"rgba(255,107,107,0.12)",border:"1px solid rgba(255,107,107,0.3)",color:"#FF6B6B",borderRadius:8,width:32,height:32,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center" }}>×</button>
              </div>
            ))}
          </div>
        )}

        {/* EXPENSES */}
        {tab==="expenses"&&(
          <div style={{ padding:"1rem 1.2rem" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem" }}>
              <h2 style={{ margin:0,fontSize:14,fontWeight:700,color:"#a89fc8",textTransform:"uppercase",letterSpacing:1 }}>💸 Expenses</h2>
              <div style={{ display:"flex",gap:8 }}>
                <button onClick={()=>setShowScanner(true)} style={{ background:"rgba(124,58,237,0.15)",border:"1px solid rgba(124,58,237,0.3)",color:"#a78bfa",padding:"0.4rem 0.8rem",borderRadius:20,fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer" }}>📷 Scan</button>
                <button onClick={()=>openAddExpense()} style={{ background:"#FF6B6B",border:"none",color:"#fff",padding:"0.4rem 0.9rem",borderRadius:20,fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer" }}>+ Add</button>
              </div>
            </div>
            {expenses.length===0?(
              <div style={{ textAlign:"center",padding:"3rem 1rem",color:"#444" }}><div style={{ fontSize:52 }}>🧾</div><div style={{ fontWeight:600,marginTop:10 }}>No expenses yet</div><div style={{ fontSize:13,marginTop:4 }}>Add manually or scan a receipt 📷</div></div>
            ):expenses.map(exp=>{
              const paidBy=exp.paid_by||exp.paidBy;
              const splitAmong=exp.split_among||exp.splitAmong||[];
              const payer=getM(paidBy);
              return (
                <div key={exp.id} style={{ background:"#1c1635",borderRadius:14,padding:"1rem",marginBottom:"0.7rem",border:"1px solid rgba(124,58,237,0.15)" }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex",gap:6,alignItems:"center",marginBottom:6,flexWrap:"wrap" }}><Tag label={exp.category} color="#a78bfa"/><span style={{ fontSize:11,color:"#444" }}>{exp.date}</span></div>
                      <div style={{ fontWeight:700,fontSize:15,marginBottom:4 }}>{exp.desc||exp.description}</div>
                      <div style={{ fontSize:12,color:"#8878aa" }}>Paid by <span style={{ color:payer?.color,fontWeight:600 }}>{payer?.name}</span> · ₹{(parseFloat(exp.amount)/splitAmong.length).toFixed(2)}/person</div>
                    </div>
                    <div style={{ display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6 }}>
                      <div style={{ fontWeight:800,fontSize:18,color:"#FFD93D" }}>₹{parseFloat(exp.amount).toLocaleString("en-IN")}</div>
                      <button onClick={()=>{if(window.confirm("Delete this expense?")) deleteExpense(exp.id);}} style={{ background:"rgba(255,107,107,0.1)",border:"1px solid rgba(255,107,107,0.25)",color:"#FF6B6B",borderRadius:7,padding:"2px 8px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Outfit',sans-serif" }}>🗑 Delete</button>
                    </div>
                  </div>
                  <div style={{ display:"flex",gap:5,marginTop:10,flexWrap:"wrap" }}>
                    {splitAmong.map(id=>{const m=getM(id);return m?(<div key={id} style={{ display:"flex",alignItems:"center",gap:4,background:"rgba(255,255,255,0.04)",borderRadius:20,padding:"2px 8px" }}><Avatar name={m.name} color={m.color} size={16}/><span style={{ fontSize:11,color:"#777" }}>{m.name}</span></div>):null;})}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* SUMMARY */}
        {tab==="summary"&&(
          <div style={{ padding:"1rem 1.2rem" }}>
            <h2 style={{ margin:"0 0 1rem",fontSize:14,fontWeight:700,color:"#a89fc8",textTransform:"uppercase",letterSpacing:1 }}>📊 Summary & Settlements</h2>
            {members.length===0?(
              <div style={{ textAlign:"center",padding:"3rem 1rem",color:"#444" }}><div style={{ fontSize:52 }}>📊</div><div style={{ fontWeight:600,marginTop:10 }}>Add members & expenses first</div></div>
            ):(
              <>
                <div style={{ fontSize:11,color:"#7a6f9a",fontWeight:700,marginBottom:"0.6rem",textTransform:"uppercase",letterSpacing:1 }}>Per Person Breakdown</div>
                {members.map(m=>{
                  const d=settlements.memberSpend[m.id]||{paid:0,share:0}; const net=d.paid-d.share;
                  const owedBy=settlements.txns.filter(t=>t.to===m.id);
                  const owesTo=settlements.txns.filter(t=>t.from===m.id);
                  return (
                    <div key={m.id} style={{ background:"#1c1635",borderRadius:14,padding:"1rem",marginBottom:"0.7rem",border:`1.5px solid ${net>0.01?"rgba(107,203,119,0.3)":net<-0.01?"rgba(255,107,107,0.3)":"rgba(255,255,255,0.07)"}` }}>
                      <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:(owedBy.length||owesTo.length)?"0.8rem":0 }}>
                        <Avatar name={m.name} color={m.color} size={38}/>
                        <div style={{ flex:1 }}><div style={{ fontWeight:800,fontSize:15 }}>{m.name}</div><div style={{ fontSize:12,color:"#7a6fa0",marginTop:2 }}>Paid ₹{d.paid.toFixed(2)} · Share ₹{d.share.toFixed(2)}</div></div>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontSize:10,color:"#555",fontWeight:600 }}>{net>0.01?"TO RECEIVE":net<-0.01?"TO PAY":"SETTLED"}</div>
                          <div style={{ fontWeight:900,fontSize:17,color:net>0.01?"#6BCB77":net<-0.01?"#FF6B6B":"#555" }}>{net>0.01?`₹${net.toFixed(2)}`:net<-0.01?`₹${Math.abs(net).toFixed(2)}`:"✓"}</div>
                        </div>
                      </div>
                      {owedBy.length>0&&(
                        <div style={{ background:"rgba(107,203,119,0.06)",border:"1px solid rgba(107,203,119,0.15)",borderRadius:10,padding:"0.5rem 0.8rem",marginBottom:owesTo.length?"0.5rem":0 }}>
                          <div style={{ fontSize:10,color:"#6BCB77",fontWeight:700,marginBottom:4,textTransform:"uppercase",letterSpacing:0.8 }}>💰 Gets from</div>
                          {owedBy.map((t,i)=>{const dbm=getM(t.from);return dbm?(<div key={i} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"3px 0" }}><div style={{ display:"flex",alignItems:"center",gap:6 }}><Avatar name={dbm.name} color={dbm.color} size={20}/><span style={{ fontSize:13,color:"#ccc",fontWeight:600 }}>{dbm.name}</span></div><span style={{ fontSize:14,fontWeight:800,color:"#6BCB77" }}>₹{t.amount.toFixed(2)}</span></div>):null;})}
                        </div>
                      )}
                      {owesTo.length>0&&(
                        <div style={{ background:"rgba(255,107,107,0.06)",border:"1px solid rgba(255,107,107,0.15)",borderRadius:10,padding:"0.5rem 0.8rem" }}>
                          <div style={{ fontSize:10,color:"#FF6B6B",fontWeight:700,marginBottom:4,textTransform:"uppercase",letterSpacing:0.8 }}>🔴 Owes to</div>
                          {owesTo.map((t,i)=>{const cr=getM(t.to);return cr?(<div key={i} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"3px 0" }}><div style={{ display:"flex",alignItems:"center",gap:6 }}><Avatar name={cr.name} color={cr.color} size={20}/><span style={{ fontSize:13,color:"#ccc",fontWeight:600 }}>{cr.name}</span></div><span style={{ fontSize:14,fontWeight:800,color:"#FF6B6B" }}>₹{t.amount.toFixed(2)}</span></div>):null;})}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div style={{ fontSize:11,color:"#7a6f9a",fontWeight:700,margin:"1rem 0 0.6rem",textTransform:"uppercase",letterSpacing:1 }}>Settlement Transactions</div>
                {settlements.txns.length===0?(
                  <div style={{ background:"rgba(107,203,119,0.07)",border:"1px solid rgba(107,203,119,0.18)",borderRadius:12,padding:"1rem",textAlign:"center" }}><div style={{ fontSize:26 }}>🎉</div><div style={{ color:"#6BCB77",fontWeight:700,marginTop:4 }}>All settled up!</div></div>
                ):settlements.txns.map((t,i)=>{
                  const dm=getM(t.from),cm=getM(t.to); if(!dm||!cm) return null;
                  return (
                    <div key={i} style={{ background:"linear-gradient(135deg,#1c1635,#1a0d36)",borderRadius:16,padding:"1.2rem",marginBottom:"0.9rem",border:"1px solid rgba(124,58,237,0.2)" }}>
                      <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:"1rem" }}>
                        <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:5,minWidth:64 }}><Avatar name={dm.name} color={dm.color} size={44}/><span style={{ fontSize:12,fontWeight:700,color:dm.color,maxWidth:70,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{dm.name}</span></div>
                        <div style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4 }}>
                          <div style={{ fontWeight:900,fontSize:22,color:"#FF6B6B" }}>₹{t.amount.toFixed(2)}</div>
                          <div style={{ display:"flex",alignItems:"center",gap:4,width:"100%" }}><div style={{ flex:1,height:2,background:"linear-gradient(90deg,#7C3AED,#10B981)" }}/><span style={{ fontSize:18,color:"#10B981" }}>➤</span></div>
                          <div style={{ fontSize:11,color:"#555",fontWeight:600 }}>PAYS TO</div>
                        </div>
                        <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:5,minWidth:64 }}><Avatar name={cm.name} color={cm.color} size={44}/><span style={{ fontSize:12,fontWeight:700,color:cm.color,maxWidth:70,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{cm.name}</span></div>
                      </div>
                      <div style={{ background:"rgba(124,58,237,0.07)",border:"1px solid rgba(124,58,237,0.15)",borderRadius:10,padding:"0.55rem 0.9rem",fontSize:13,color:"#ccc",marginBottom:"0.9rem",textAlign:"center" }}>
                        <span style={{ color:dm.color,fontWeight:700 }}>{dm.name}</span> must pay <span style={{ color:"#FFD93D",fontWeight:800 }}>₹{t.amount.toFixed(2)}</span> to <span style={{ color:cm.color,fontWeight:700 }}>{cm.name}</span>
                      </div>
                      <div style={{ display:"flex",gap:8 }}>
                        <button onClick={()=>setPaymentModal({txn:t,debtorM:dm,creditorM:cm})} style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,background:"rgba(107,203,119,0.12)",border:"1px solid rgba(107,203,119,0.3)",color:"#6BCB77",borderRadius:10,padding:"0.5rem",fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:12,cursor:"pointer" }}>✅ Mark Paid</button>
                        {dm.whatsapp?(
                          <a href={waLink(dm,cm,t.amount)} target="_blank" rel="noreferrer" style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,background:"rgba(37,211,102,0.1)",border:"1px solid rgba(37,211,102,0.25)",color:"#25D366",borderRadius:10,padding:"0.5rem",textDecoration:"none",fontWeight:700,fontSize:12,fontFamily:"'Outfit',sans-serif" }}>💬 Remind</a>
                        ):(
                          <button style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",color:"#555",borderRadius:10,padding:"0.5rem",fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:12,cursor:"pointer" }} onClick={()=>showToast(`${dm.name} has no WhatsApp number`,"error")}>💬 Remind</button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {payments.length>0&&(
                  <>
                    <div style={{ fontSize:11,color:"#7a6f9a",fontWeight:700,margin:"1rem 0 0.6rem",textTransform:"uppercase",letterSpacing:1 }}>Payment History</div>
                    {payments.map(pmt=>{
                      const fm=getM(pmt.from_id),tm=getM(pmt.to_id);
                      return fm&&tm?(<div key={pmt.id} style={{ background:"rgba(107,203,119,0.05)",border:"1px solid rgba(107,203,119,0.15)",borderRadius:12,padding:"0.7rem 1rem",marginBottom:"0.5rem",display:"flex",alignItems:"center",justifyContent:"space-between" }}><div style={{ fontSize:13,color:"#aaa" }}><span style={{ color:fm.color,fontWeight:700 }}>{fm.name}</span> → <span style={{ color:tm.color,fontWeight:700 }}>{tm.name}</span><span style={{ fontSize:11,color:"#444",marginLeft:8 }}>{pmt.date}</span></div><span style={{ fontWeight:800,color:"#6BCB77",fontSize:14 }}>₹{parseFloat(pmt.amount).toFixed(2)}</span></div>):null;
                    })}
                  </>
                )}
              </>
            )}
          </div>
        )}
        {tab==="chat"&&<ChatTab members={members} tripName={trip.name} expenses={expenses}/>}
      </div>

      <div style={{ background:"#12102a",borderTop:"2px solid rgba(124,58,237,0.35)",padding:"0.4rem 0.5rem",display:"flex",gap:3,flexShrink:0 }}>
        <NavBtn id="members" label="Members" icon="👥"/>
        <NavBtn id="expenses" label="Expenses" icon="💸"/>
        <NavBtn id="summary" label="Summary" icon="📊"/>
        <NavBtn id="chat" label="Chat" icon="💬"/>
      </div>

      {/* Modals */}
      {showAddMember&&(
        <Modal onClose={()=>setShowAddMember(false)}>
          <h2 style={{ margin:"0 0 1.2rem",fontWeight:800,fontSize:20 }}>👤 Add Member</h2>
          {[{label:"Name *",key:"name",placeholder:"e.g. Rahul",type:"text"},{label:"WhatsApp Number",key:"whatsapp",placeholder:"+91 9876543210",type:"tel"}].map(f=>(
            <div key={f.key} style={{ marginBottom:"1rem" }}><label style={lStyle}>{f.label}</label><input value={memberForm[f.key]} onChange={e=>setMemberForm(p=>({...p,[f.key]:e.target.value}))} placeholder={f.placeholder} type={f.type} onKeyDown={e=>e.key==="Enter"&&addMember()} style={iStyle}/></div>
          ))}
          <div style={{ fontSize:11,color:"#444",marginBottom:"1.2rem" }}>WhatsApp number is used to send payment reminders</div>
          <div style={{ display:"flex",gap:10 }}>
            <button onClick={()=>setShowAddMember(false)} style={{ flex:1,background:"rgba(124,58,237,0.1)",border:"1px solid rgba(124,58,237,0.2)",color:"#a78bfa",borderRadius:12,padding:"0.7rem",fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer" }}>Cancel</button>
            <button onClick={addMember} disabled={savingMem} style={{ flex:2,background:"linear-gradient(135deg,#7C3AED,#10B981)",border:"none",color:"#fff",borderRadius:12,padding:"0.7rem",fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
              {savingMem?<Spinner/>:null}{savingMem?"Saving…":"Add Member"}
            </button>
          </div>
        </Modal>
      )}
      {showAddExpense&&(
        <Modal onClose={()=>setShowAddExpense(false)}>
          <h2 style={{ margin:"0 0 1.2rem",fontWeight:800,fontSize:20 }}>💸 Add Expense</h2>
          <div style={{ marginBottom:"1rem" }}><label style={lStyle}>Description *</label><input value={expenseForm.desc} onChange={e=>setExpenseForm(f=>({...f,desc:e.target.value}))} placeholder="e.g. Dinner at hotel" style={iStyle}/></div>
          <div style={{ marginBottom:"1rem" }}><label style={lStyle}>Amount (₹) *</label><input value={expenseForm.amount} onChange={e=>setExpenseForm(f=>({...f,amount:e.target.value}))} placeholder="0.00" type="number" style={iStyle}/></div>
          <div style={{ marginBottom:"1rem" }}><label style={lStyle}>Date</label><input value={expenseForm.date} onChange={e=>setExpenseForm(f=>({...f,date:e.target.value}))} placeholder="DD/MM/YYYY" style={iStyle}/></div>
          <div style={{ marginBottom:"1rem" }}>
            <label style={lStyle}>Category</label>
            <div style={{ display:"flex",flexWrap:"wrap",gap:5 }}>{CATEGORIES.map(cat=>(<button key={cat} onClick={()=>setExpenseForm(f=>({...f,category:cat}))} style={{ background:expenseForm.category===cat?"rgba(124,58,237,0.2)":"rgba(255,255,255,0.04)",border:`1px solid ${expenseForm.category===cat?"#7C3AED":"rgba(255,255,255,0.1)"}`,color:expenseForm.category===cat?"#a78bfa":"#777",borderRadius:8,padding:"4px 10px",fontSize:12,cursor:"pointer",fontFamily:"'Outfit',sans-serif",fontWeight:600 }}>{cat}</button>))}</div>
          </div>
          <div style={{ marginBottom:"1rem" }}>
            <label style={lStyle}>Paid By *</label>
            <div style={{ display:"flex",flexWrap:"wrap",gap:6 }}>{members.map(m=>(<button key={m.id} onClick={()=>setExpenseForm(f=>({...f,paid_by:m.id}))} style={{ display:"flex",alignItems:"center",gap:6,background:expenseForm.paid_by===m.id?m.color+"22":"rgba(255,255,255,0.04)",border:`1px solid ${expenseForm.paid_by===m.id?m.color:"rgba(255,255,255,0.1)"}`,color:expenseForm.paid_by===m.id?m.color:"#777",borderRadius:20,padding:"4px 12px",fontSize:13,cursor:"pointer",fontFamily:"'Outfit',sans-serif",fontWeight:600 }}><Avatar name={m.name} color={m.color} size={20}/>{m.name}</button>))}</div>
          </div>
          <div style={{ marginBottom:"1.2rem" }}>
            <label style={lStyle}>Split Among *</label>
            <div style={{ display:"flex",flexWrap:"wrap",gap:6 }}>{members.map(m=>{const on=expenseForm.split_among.includes(m.id);return(<button key={m.id} onClick={()=>toggleSplit(m.id)} style={{ display:"flex",alignItems:"center",gap:6,background:on?m.color+"22":"rgba(255,255,255,0.04)",border:`1px solid ${on?m.color:"rgba(255,255,255,0.1)"}`,color:on?m.color:"#777",borderRadius:20,padding:"4px 12px",fontSize:13,cursor:"pointer",fontFamily:"'Outfit',sans-serif",fontWeight:600 }}><Avatar name={m.name} color={m.color} size={20}/>{m.name}{on?" ✓":""}</button>);})}</div>
            {expenseForm.split_among.length>0&&expenseForm.amount&&<div style={{ fontSize:12,color:"#a78bfa",marginTop:6,fontWeight:600 }}>₹{(parseFloat(expenseForm.amount||0)/expenseForm.split_among.length).toFixed(2)} per person</div>}
          </div>
          <div style={{ display:"flex",gap:10 }}>
            <button onClick={()=>setShowAddExpense(false)} style={{ flex:1,background:"rgba(124,58,237,0.1)",border:"1px solid rgba(124,58,237,0.2)",color:"#a78bfa",borderRadius:12,padding:"0.7rem",fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer" }}>Cancel</button>
            <button onClick={addExpense} disabled={savingExp} style={{ flex:2,background:"#FF6B6B",border:"none",color:"#fff",borderRadius:12,padding:"0.7rem",fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
              {savingExp?<Spinner/>:null}{savingExp?"Saving…":"Add Expense"}
            </button>
          </div>
        </Modal>
      )}
      {showScanner&&<ReceiptScanner onClose={()=>setShowScanner(false)} onExtracted={data=>{setShowScanner(false);openAddExpense(data);}}/>}
      {paymentModal&&<PaymentModal txn={paymentModal.txn} debtorM={paymentModal.debtorM} creditorM={paymentModal.creditorM} onClose={()=>setPaymentModal(null)} onPayment={recordPayment}/>}
    </div>
  );
}

/* ══════════════════════════════════════
   HOME SCREEN
══════════════════════════════════════ */
function HomeScreen({ trips,loading,onSelectTrip,onCreateTrip,onDeleteTrip,showToast }) {
  const [showNew,setShowNew]=useState(false);
  const [form,setForm]=useState({name:"",cover:TRIP_COVERS[0],date:""});
  const [saving,setSaving]=useState(false);

  const createTrip=async()=>{
    if(!form.name.trim()){showToast("Enter a trip name!","error");return;}
    setSaving(true);
    const result=await db.createTrip({name:form.name.trim(),cover:form.cover,date:form.date||new Date().toLocaleDateString("en-IN")});
    if(result){
      onCreateTrip(Array.isArray(result)?result[0]:result);
      showToast(`${form.name.trim()} created! 🎉`);
    } else showToast("Failed to create trip","error");
    setForm({name:"",cover:TRIP_COVERS[0],date:""}); setShowNew(false); setSaving(false);
  };

  return (
    <div style={{ width:"100%",maxWidth:480,display:"flex",flexDirection:"column",minHeight:"100vh" }}>
      <div style={{ background:"linear-gradient(145deg,#1a0e3a 0%,#16083a 40%,#0a2a1a 100%)",padding:"1.4rem 1.4rem 1.2rem",borderBottom:"1px solid rgba(124,58,237,0.25)" }}>
        <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:4 }}>
          <SplitifyLogo size={44}/>
          <div>
            <div style={{ fontFamily:"'Poppins',sans-serif",fontWeight:900,fontSize:28,lineHeight:1,letterSpacing:-0.5 }}>
              <span style={{ color:"#fff",textShadow:"0 0 30px rgba(124,58,237,0.5)" }}>Split</span><span style={{ color:"#2dd4a0",textShadow:"0 0 20px rgba(45,212,160,0.4)" }}>ify</span>
            </div>
            <div style={{ fontSize:12,color:"#8b7faa",fontWeight:600,marginTop:2,letterSpacing:0.3 }}>Split expenses. Stay friends.</div>
          </div>
          <div style={{ flex:1 }}/>
          <div style={{ background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.25)",borderRadius:20,padding:"4px 10px",fontSize:10,fontWeight:700,color:"#10B981",display:"flex",alignItems:"center",gap:4 }}>
            <div style={{ width:6,height:6,borderRadius:"50%",background:"#10B981",animation:"pulse 2s infinite" }}/>LIVE SYNC
          </div>
        </div>
      </div>

      <div style={{ flex:1,overflowY:"auto",padding:"1.2rem" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem" }}>
          <h2 style={{ margin:0,fontSize:14,fontWeight:700,color:"#a89fc8",textTransform:"uppercase",letterSpacing:1 }}>✈️ Your Trips</h2>
          <button onClick={()=>setShowNew(true)} style={{ background:"linear-gradient(135deg,#7C3AED,#10B981)",border:"none",color:"#fff",padding:"0.45rem 1.1rem",borderRadius:20,fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer" }}>+ New Trip</button>
        </div>

        {loading?(
          <div style={{ textAlign:"center",padding:"4rem 1rem" }}><Spinner/><div style={{ fontSize:14,color:"#555",marginTop:16,fontWeight:600 }}>Loading trips…</div></div>
        ):trips.length===0?(
          <div style={{ textAlign:"center",padding:"4rem 1rem" }}>
            <div style={{ fontSize:64,marginBottom:"1rem" }}>✈️</div>
            <div style={{ fontWeight:700,fontSize:18,color:"#ccc" }}>No trips yet!</div>
            <div style={{ fontSize:14,color:"#8b7faa",marginTop:6,marginBottom:"1.5rem" }}>Create your first trip to get started</div>
            <button onClick={()=>setShowNew(true)} style={{ background:"linear-gradient(135deg,#7C3AED,#10B981)",border:"none",color:"#fff",padding:"0.7rem 2rem",borderRadius:20,fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer" }}>+ Create Trip</button>
          </div>
        ):(
          trips.map(trip=>{
            const total=(trip.expense_total)||0;
            return (
              <div key={trip.id} onClick={()=>onSelectTrip(trip.id)} style={{ background:"linear-gradient(135deg,#1e1540,#18122e)",borderRadius:18,padding:"1.1rem 1.2rem",marginBottom:"0.9rem",cursor:"pointer",border:"1px solid rgba(124,58,237,0.15)",position:"relative",overflow:"hidden" }}>
                <div style={{ position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,#7C3AED,#10B981)" }}/>
                <div style={{ display:"flex",alignItems:"center",gap:12 }}>
                  <div style={{ width:52,height:52,borderRadius:14,background:"linear-gradient(135deg,rgba(124,58,237,0.3),rgba(16,185,129,0.25))",border:"1px solid rgba(124,58,237,0.5)",boxShadow:"0 4px 20px rgba(124,58,237,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0 }}>{trip.cover}</div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontWeight:800,fontSize:16,color:"#e8e0ff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{trip.name}</div>
                    <div style={{ fontSize:12,color:"#7a6f9a",marginTop:2 }}>{trip.date}</div>
                  </div>
                  <div style={{ textAlign:"right",flexShrink:0 }}>
                    <div style={{ fontWeight:800,fontSize:17,color:"#a78bfa" }}>Open Trip →</div>
                    <div style={{ fontSize:10,color:"#555",marginTop:2 }}>→</div>
                  </div>
                </div>
                <div style={{ display:"flex",justifyContent:"flex-end",marginTop:8 }}>
                  <button onClick={e=>{e.stopPropagation();if(window.confirm(`Delete "${trip.name}"? This cannot be undone.`)) onDeleteTrip(trip.id);}} style={{ background:"rgba(255,107,107,0.1)",border:"1px solid rgba(255,107,107,0.2)",color:"#FF6B6B",borderRadius:8,padding:"3px 8px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Outfit',sans-serif" }}>🗑 Delete</button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showNew&&(
        <Modal onClose={()=>setShowNew(false)}>
          <h2 style={{ margin:"0 0 1.2rem",fontWeight:800,fontSize:20 }}>✈️ New Trip</h2>
          <div style={{ marginBottom:"1rem" }}>
            <label style={{ fontSize:11,color:"#555",fontWeight:700,display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:0.9 }}>Trip Name *</label>
            <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Goa 2025" onKeyDown={e=>e.key==="Enter"&&createTrip()} style={{ width:"100%",background:"rgba(124,58,237,0.08)",border:"1px solid rgba(124,58,237,0.25)",borderRadius:10,padding:"0.7rem 0.9rem",color:"#fff",fontFamily:"'Outfit',sans-serif",fontSize:15,outline:"none",boxSizing:"border-box" }}/>
          </div>
          <div style={{ marginBottom:"1rem" }}>
            <label style={{ fontSize:11,color:"#555",fontWeight:700,display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:0.9 }}>Trip Date</label>
            <input value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} placeholder="e.g. Dec 2025" style={{ width:"100%",background:"rgba(124,58,237,0.08)",border:"1px solid rgba(124,58,237,0.25)",borderRadius:10,padding:"0.7rem 0.9rem",color:"#fff",fontFamily:"'Outfit',sans-serif",fontSize:15,outline:"none",boxSizing:"border-box" }}/>
          </div>
          <div style={{ marginBottom:"1.4rem" }}>
            <label style={{ fontSize:11,color:"#555",fontWeight:700,display:"block",marginBottom:8,textTransform:"uppercase",letterSpacing:0.9 }}>Pick an Icon</label>
            <div style={{ display:"flex",flexWrap:"wrap",gap:8 }}>{TRIP_COVERS.map(c=>(<button key={c} onClick={()=>setForm(f=>({...f,cover:c}))} style={{ width:44,height:44,borderRadius:12,background:form.cover===c?"rgba(124,58,237,0.25)":"rgba(255,255,255,0.04)",border:`2px solid ${form.cover===c?"#7C3AED":"rgba(255,255,255,0.1)"}`,fontSize:22,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>{c}</button>))}</div>
          </div>
          <div style={{ display:"flex",gap:10 }}>
            <button onClick={()=>setShowNew(false)} style={{ flex:1,background:"rgba(124,58,237,0.1)",border:"1px solid rgba(124,58,237,0.2)",color:"#a78bfa",borderRadius:12,padding:"0.7rem",fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer" }}>Cancel</button>
            <button onClick={createTrip} disabled={saving} style={{ flex:2,background:"linear-gradient(135deg,#7C3AED,#10B981)",border:"none",color:"#fff",borderRadius:12,padding:"0.7rem",fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
              {saving?<Spinner/>:null}{saving?"Creating…":"Create Trip 🚀"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ══════════════════════════════════════
   ROOT
══════════════════════════════════════ */
export default function App() {
  const [trips,setTrips]=useState([]);
  const [loading,setLoading]=useState(true);
  const [activeTrip,setActiveTrip]=useState(null);
  const [toast,setToast]=useState(null);
  const showToast=useCallback((msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast(null),2800);},[]);

  useEffect(()=>{
    db.getTrips().then(t=>{ setTrips(t||[]); setLoading(false); });
    const unsub=db.subscribe("trips","all",(evt,rec,old)=>{
      if(evt==="INSERT") setTrips(p=>[rec,...p]);
      if(evt==="DELETE") setTrips(p=>p.filter(t=>t.id!==old?.id));
    });
    return ()=>unsub();
  },[]);

  const deleteTrip=async(id)=>{
    await db.deleteTrip(id);
    setTrips(p=>p.filter(t=>t.id!==id));
    if(activeTrip===id) setActiveTrip(null);
    showToast("Trip deleted");
  };

  const currentTrip=trips.find(t=>t.id===activeTrip);

  return (
    <div style={{ minHeight:"100vh",background:"#0e0b1e",fontFamily:"'Outfit',sans-serif",color:"#e8e8f0",display:"flex",flexDirection:"column",alignItems:"center" }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Poppins:wght@700;800;900&display=swap" rel="stylesheet"/>
      <Toast toast={toast}/>
      {activeTrip&&currentTrip
        ?<TripDetail trip={currentTrip} onBack={()=>setActiveTrip(null)} showToast={showToast}/>
        :<HomeScreen trips={trips} loading={loading} onSelectTrip={setActiveTrip} onCreateTrip={t=>setTrips(p=>[t,...p])} onDeleteTrip={deleteTrip} showToast={showToast}/>
      }
    </div>
  );
}
