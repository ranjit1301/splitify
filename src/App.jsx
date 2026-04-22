import { useState, useMemo, useRef, useEffect, useCallback } from "react";

const COLORS = ["#FF6B6B","#FFD93D","#6BCB77","#4D96FF","#C77DFF","#FF9F1C","#2EC4B6","#E71D36"];
const CATEGORIES = ["✈️ Travel","🍔 Food","🏨 Stay","🎡 Activity","🛒 Shopping","⛽ Fuel","🎟️ Tickets","💊 Medical","📦 Other"];

/* ── helpers ── */
function Avatar({ name, color, size = 40 }) {
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", background:color, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:size*0.38, color:"#fff", flexShrink:0, boxShadow:`0 2px 8px ${color}55`, fontFamily:"'Outfit',sans-serif" }}>
      {name.trim().charAt(0).toUpperCase()}
    </div>
  );
}

function Modal({ children, onClose, wide }) {
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(10,10,20,0.82)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(6px)", padding:"1rem" }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#1a1a2e", borderRadius:20, padding:"1.8rem", width:"100%", maxWidth: wide ? 520 : 440, boxShadow:"0 24px 64px rgba(0,0,0,0.6)", border:"1px solid rgba(255,255,255,0.08)", maxHeight:"92vh", overflowY:"auto" }}>
        {children}
      </div>
    </div>
  );
}

function Tag({ label, color }) {
  return <span style={{ background:color+"22", color, border:`1px solid ${color}44`, borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:600, fontFamily:"'Outfit',sans-serif" }}>{label}</span>;
}

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div style={{ position:"fixed", top:24, left:"50%", transform:"translateX(-50%)", background:toast.type==="error"?"#FF6B6B":"#6BCB77", color:"#fff", padding:"0.6rem 1.5rem", borderRadius:30, fontWeight:700, fontSize:14, zIndex:999, boxShadow:"0 8px 24px rgba(0,0,0,0.4)", whiteSpace:"nowrap", fontFamily:"'Outfit',sans-serif" }}>{toast.msg}</div>
  );
}

/* ── RECEIPT SCANNER ── */
function ReceiptScanner({ onExtracted, onClose }) {
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  const processFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const b64 = e.target.result.split(",")[1];
      const mediaType = file.type;
      setPreview(e.target.result);
      setScanning(true);
      setResult(null);
      try {
        const res = await fetch("/api/claude", {
          method:"POST",
          headers:{ "Content-Type":"application/json" },
          body: JSON.stringify({
            model:"claude-sonnet-4-20250514",
            max_tokens:1000,
            messages:[{
              role:"user",
              content:[
                { type:"image", source:{ type:"base64", media_type:mediaType, data:b64 }},
                { type:"text", text:`You are a receipt data extractor. Analyze this receipt image and extract:
1. Total amount (number only, no currency symbol)
2. Date (in DD/MM/YYYY format, or today if not visible)
3. Description (short: merchant name + what was bought, max 40 chars)
4. Line items (array of {name, amount})

Respond ONLY with valid JSON, no markdown, no explanation:
{"total": 0.00, "date": "DD/MM/YYYY", "description": "...", "items": [{"name":"...","amount":0.00}]}` }
              ]
            }]
          })
        });
        const data = await res.json();
        const raw = data.content?.find(b=>b.type==="text")?.text || "{}";
        const clean = raw.replace(/```json|```/g,"").trim();
        const parsed = JSON.parse(clean);
        setResult(parsed);
      } catch {
        setResult({ error: true });
      }
      setScanning(false);
    };
    reader.readAsDataURL(file);
  };

  const onDrop = (e) => { e.preventDefault(); setDragOver(false); processFile(e.dataTransfer.files[0]); };

  return (
    <Modal onClose={onClose} wide>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.2rem" }}>
        <h2 style={{ margin:0, fontWeight:800, fontSize:20 }}>🧾 AI Receipt Scanner</h2>
        <button onClick={onClose} style={{ background:"none", border:"none", color:"#555", fontSize:22, cursor:"pointer" }}>×</button>
      </div>

      {/* Drop zone */}
      {!preview && (
        <div
          onDrop={onDrop} onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)}
          onClick={()=>fileRef.current.click()}
          style={{ border:`2px dashed ${dragOver?"#4D96FF":"rgba(255,255,255,0.15)"}`, borderRadius:16, padding:"2.5rem 1rem", textAlign:"center", cursor:"pointer", background:dragOver?"rgba(77,150,255,0.06)":"rgba(255,255,255,0.02)", transition:"all 0.2s" }}>
          <div style={{ fontSize:48, marginBottom:"0.6rem" }}>📷</div>
          <div style={{ fontWeight:700, fontSize:15, color:"#ccc" }}>Drop receipt image here</div>
          <div style={{ fontSize:13, color:"#555", marginTop:4 }}>or click to upload</div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={e=>processFile(e.target.files[0])} />
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div style={{ display:"flex", gap:"1rem", flexWrap:"wrap" }}>
          <img src={preview} alt="receipt" style={{ width:160, height:200, objectFit:"cover", borderRadius:12, border:"1px solid rgba(255,255,255,0.1)", flexShrink:0 }} />
          <div style={{ flex:1, minWidth:180 }}>
            {scanning && (
              <div style={{ textAlign:"center", padding:"2rem 0" }}>
                <div style={{ fontSize:32, marginBottom:"0.5rem" }}>🔍</div>
                <div style={{ color:"#4D96FF", fontWeight:700, fontSize:14 }}>Scanning receipt…</div>
                <div style={{ color:"#555", fontSize:12, marginTop:4 }}>AI is extracting data</div>
              </div>
            )}
            {result && !result.error && (
              <div>
                <div style={{ fontSize:12, color:"#6BCB77", fontWeight:700, marginBottom:"0.8rem" }}>✅ Extracted successfully!</div>
                <div style={{ background:"rgba(107,203,119,0.07)", border:"1px solid rgba(107,203,119,0.2)", borderRadius:12, padding:"0.9rem" }}>
                  <Row label="Description" value={result.description} />
                  <Row label="Total" value={`₹${parseFloat(result.total||0).toFixed(2)}`} highlight />
                  <Row label="Date" value={result.date} />
                  {result.items?.length > 0 && (
                    <div style={{ marginTop:"0.6rem" }}>
                      <div style={{ fontSize:11, color:"#555", fontWeight:700, textTransform:"uppercase", letterSpacing:0.8, marginBottom:4 }}>Items</div>
                      {result.items.map((it,i)=>(
                        <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#aaa", padding:"2px 0" }}>
                          <span>{it.name}</span><span style={{ color:"#FFD93D" }}>₹{parseFloat(it.amount||0).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display:"flex", gap:8, marginTop:"1rem" }}>
                  <button onClick={()=>{setPreview(null);setResult(null);}} style={{ flex:1, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#777", borderRadius:10, padding:"0.6rem", fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:13, cursor:"pointer" }}>Re-scan</button>
                  <button onClick={()=>onExtracted(result)} style={{ flex:2, background:"#6BCB77", border:"none", color:"#fff", borderRadius:10, padding:"0.6rem", fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:13, cursor:"pointer" }}>Use This →</button>
                </div>
              </div>
            )}
            {result?.error && (
              <div style={{ textAlign:"center", padding:"1.5rem 0" }}>
                <div style={{ fontSize:32 }}>😕</div>
                <div style={{ color:"#FF6B6B", fontWeight:700, marginTop:8 }}>Couldn't read receipt</div>
                <button onClick={()=>{setPreview(null);setResult(null);}} style={{ marginTop:"0.8rem", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#aaa", borderRadius:10, padding:"0.5rem 1rem", fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:13, cursor:"pointer" }}>Try again</button>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function Row({ label, value, highlight }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
      <span style={{ fontSize:11, color:"#555", fontWeight:600, textTransform:"uppercase", letterSpacing:0.7 }}>{label}</span>
      <span style={{ fontSize: highlight?16:13, fontWeight: highlight?800:600, color: highlight?"#FFD93D":"#ccc" }}>{value}</span>
    </div>
  );
}

/* ── PAYMENT MODAL (partial payment / mark paid) ── */
function PaymentModal({ txn, debtorM, creditorM, onClose, onPayment }) {
  const [amount, setAmount] = useState(txn.amount.toFixed(2));
  const [mode, setMode] = useState("full"); // full | partial

  const handlePay = () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0 || amt > txn.amount + 0.01) return;
    onPayment(txn, Math.min(amt, txn.amount));
    onClose();
  };

  return (
    <Modal onClose={onClose}>
      <h2 style={{ margin:"0 0 1.2rem", fontWeight:800, fontSize:19 }}>💳 Record Payment</h2>
      <div style={{ display:"flex", alignItems:"center", gap:10, background:"rgba(255,255,255,0.04)", borderRadius:12, padding:"0.9rem", marginBottom:"1.2rem" }}>
        <Avatar name={debtorM.name} color={debtorM.color} size={36} />
        <div style={{ flex:1, fontSize:13, color:"#bbb" }}>
          <span style={{ color:debtorM.color, fontWeight:700 }}>{debtorM.name}</span> pays <span style={{ color:creditorM.color, fontWeight:700 }}>{creditorM.name}</span>
        </div>
        <div style={{ fontWeight:800, fontSize:17, color:"#FFD93D" }}>₹{txn.amount.toFixed(2)}</div>
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:"1rem" }}>
        {["full","partial"].map(m=>(
          <button key={m} onClick={()=>{ setMode(m); if(m==="full") setAmount(txn.amount.toFixed(2)); }} style={{ flex:1, background: mode===m ? "#4D96FF22" : "rgba(255,255,255,0.04)", border:`1.5px solid ${mode===m?"#4D96FF":"rgba(255,255,255,0.1)"}`, color: mode===m?"#4D96FF":"#666", borderRadius:10, padding:"0.55rem", fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:13, cursor:"pointer" }}>
            {m==="full"?"✅ Full Payment":"⚡ Partial"}
          </button>
        ))}
      </div>

      {mode==="partial" && (
        <div style={{ marginBottom:"1rem" }}>
          <label style={{ fontSize:11, color:"#555", fontWeight:700, display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:0.9 }}>Amount Paying (₹)</label>
          <input value={amount} onChange={e=>setAmount(e.target.value)} type="number" max={txn.amount} style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:10, padding:"0.7rem 0.9rem", color:"#fff", fontFamily:"'Outfit',sans-serif", fontSize:15, outline:"none", boxSizing:"border-box" }} />
          {parseFloat(amount) < txn.amount && parseFloat(amount) > 0 && (
            <div style={{ fontSize:12, color:"#FFD93D", marginTop:5, fontWeight:600 }}>
              Remaining: ₹{(txn.amount - parseFloat(amount)).toFixed(2)}
            </div>
          )}
        </div>
      )}

      <div style={{ display:"flex", gap:10, marginTop:"0.5rem" }}>
        <button onClick={onClose} style={{ flex:1, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#666", borderRadius:12, padding:"0.7rem", fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:14, cursor:"pointer" }}>Cancel</button>
        <button onClick={handlePay} style={{ flex:2, background:"#6BCB77", border:"none", color:"#fff", borderRadius:12, padding:"0.7rem", fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:14, cursor:"pointer" }}>Mark Paid ✓</button>
      </div>
    </Modal>
  );
}

/* ── CHAT TAB ── */
function ChatTab({ members, tripName, expenses }) {
  const [messages, setMessages] = useState([
    { id:1, type:"system", text:`👋 Welcome to the ${tripName} group chat!` },
    { id:2, type:"ai", text:"Hey everyone! 🎉 I'm your trip assistant. Ask me about expenses, splitting, or trip plans!", time:new Date() }
  ]);
  const [activeMember, setActiveMember] = useState(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages, sending]);

  const fmt = d => d ? d.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}) : "";

  const sendMessage = async () => {
    if (!activeMember) { setShowHint(true); return; }
    const text = input.trim();
    if (!text || sending) return;
    setShowHint(false);
    const userMsg = { id:Date.now(), type:"user", memberId:activeMember.id, memberName:activeMember.name, memberColor:activeMember.color, text, time:new Date() };
    setMessages(p=>[...p, userMsg]);
    setInput("");
    setSending(true);
    const memberList = members.map(m=>m.name).join(", ");
    const expSummary = expenses.length ? expenses.map(e=>{ const p=members.find(m=>m.id===e.paidBy); return `${e.desc} ₹${e.amount} paid by ${p?.name}`; }).join("; ") : "No expenses yet";
    const sys = `You are a fun group chat assistant for trip "${tripName}". Members: ${memberList}. Expenses: ${expSummary}. Keep replies SHORT (1-3 sentences), casual, use emojis. Be a helpful travel buddy.`;
    const hist = messages.filter(m=>m.type==="user"||m.type==="ai").slice(-12).map(m=>({ role:m.type==="ai"?"assistant":"user", content:m.type==="user"?`[${m.memberName}]: ${m.text}`:m.text }));
    try {
      const res = await fetch("/api/claude",{ method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, system:sys, messages:[...hist,{role:"user",content:`[${activeMember.name}]: ${text}`}] }) });
      const data = await res.json();
      const reply = data.content?.find(b=>b.type==="text")?.text || "...";
      setMessages(p=>[...p,{id:Date.now()+1,type:"ai",text:reply,time:new Date()}]);
    } catch { setMessages(p=>[...p,{id:Date.now()+1,type:"ai",text:"Couldn't connect right now! 😅",time:new Date()}]); }
    setSending(false);
    setTimeout(()=>inputRef.current?.focus(),50);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", flex:1, overflow:"hidden" }}>
      <div style={{ background:"rgba(255,255,255,0.025)", borderBottom:"1px solid rgba(255,255,255,0.07)", padding:"0.55rem 1rem", display:"flex", alignItems:"center", gap:8, flexShrink:0, flexWrap:"wrap" }}>
        <span style={{ fontSize:11, color:"#555", fontWeight:700, whiteSpace:"nowrap", textTransform:"uppercase", letterSpacing:0.8 }}>You are:</span>
        {members.length===0 ? <span style={{ fontSize:12, color:"#444" }}>Add members first</span>
          : members.map(m=>(
            <button key={m.id} onClick={()=>{ setActiveMember(m); setShowHint(false); }} style={{ display:"flex", alignItems:"center", gap:5, background:activeMember?.id===m.id?m.color+"2a":"rgba(255,255,255,0.04)", border:`1.5px solid ${activeMember?.id===m.id?m.color:"rgba(255,255,255,0.07)"}`, color:activeMember?.id===m.id?m.color:"#666", borderRadius:20, padding:"3px 10px 3px 5px", fontSize:12, cursor:"pointer", fontFamily:"'Outfit',sans-serif", fontWeight:600 }}>
              <Avatar name={m.name} color={m.color} size={20} />{m.name}
            </button>
          ))}
      </div>
      {showHint && <div style={{ background:"rgba(255,107,107,0.08)", borderBottom:"1px solid rgba(255,107,107,0.15)", padding:"0.4rem 1rem", fontSize:12, color:"#FF6B6B", fontWeight:600, flexShrink:0 }}>👆 Pick who you are before sending!</div>}
      <div style={{ flex:1, overflowY:"auto", padding:"1rem", display:"flex", flexDirection:"column", gap:10 }}>
        {messages.map(msg=>{
          if (msg.type==="system") return <div key={msg.id} style={{ textAlign:"center" }}><span style={{ background:"rgba(255,255,255,0.05)", borderRadius:20, padding:"4px 16px", fontSize:12, color:"#555", fontWeight:500 }}>{msg.text}</span></div>;
          if (msg.type==="ai") return (
            <div key={msg.id} style={{ display:"flex", gap:8, alignItems:"flex-end", maxWidth:"85%" }}>
              <div style={{ width:34, height:34, borderRadius:"50%", background:"linear-gradient(135deg,#4D96FF,#C77DFF)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>🤖</div>
              <div>
                <div style={{ fontSize:10, color:"#444", marginBottom:3, fontWeight:600 }}>Trip Bot · {fmt(msg.time)}</div>
                <div style={{ background:"linear-gradient(135deg,rgba(77,150,255,0.1),rgba(199,125,255,0.1))", border:"1px solid rgba(77,150,255,0.18)", borderRadius:"4px 16px 16px 16px", padding:"0.65rem 0.95rem", fontSize:14, color:"#d8d8ee", lineHeight:1.55 }}>{msg.text}</div>
              </div>
            </div>
          );
          const isMe = msg.memberId===activeMember?.id;
          return (
            <div key={msg.id} style={{ display:"flex", gap:8, alignItems:"flex-end", maxWidth:"85%", alignSelf:isMe?"flex-end":"flex-start", flexDirection:isMe?"row-reverse":"row" }}>
              <Avatar name={msg.memberName} color={msg.memberColor} size={30} />
              <div style={{ display:"flex", flexDirection:"column", alignItems:isMe?"flex-end":"flex-start" }}>
                {!isMe && <div style={{ fontSize:10, color:msg.memberColor, marginBottom:3, fontWeight:700 }}>{msg.memberName}</div>}
                <div style={{ background:isMe?msg.memberColor+"28":"rgba(255,255,255,0.06)", border:`1px solid ${isMe?msg.memberColor+"40":"rgba(255,255,255,0.07)"}`, borderRadius:isMe?"16px 4px 16px 16px":"4px 16px 16px 16px", padding:"0.6rem 0.9rem", fontSize:14, color:"#dde", lineHeight:1.5, wordBreak:"break-word" }}>{msg.text}</div>
                <div style={{ fontSize:10, color:"#3a3a4a", marginTop:3 }}>{fmt(msg.time)}</div>
              </div>
            </div>
          );
        })}
        {sending && (
          <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
            <div style={{ width:34, height:34, borderRadius:"50%", background:"linear-gradient(135deg,#4D96FF,#C77DFF)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>🤖</div>
            <div style={{ background:"rgba(77,150,255,0.08)", border:"1px solid rgba(77,150,255,0.15)", borderRadius:"4px 16px 16px 16px", padding:"0.75rem 1.1rem" }}>
              <div style={{ display:"flex", gap:5, alignItems:"center" }}>
                {[0,1,2].map(i=><div key={i} style={{ width:6, height:6, borderRadius:"50%", background:"#4D96FF", animation:"bonce 1.2s infinite", animationDelay:`${i*0.2}s` }} />)}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={{ borderTop:"1px solid rgba(255,255,255,0.06)", padding:"0.75rem 1rem", display:"flex", gap:8, alignItems:"center", background:"#0d0d1a", flexShrink:0 }}>
        {activeMember && <Avatar name={activeMember.name} color={activeMember.color} size={26} />}
        <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();} }} placeholder={activeMember?`Message as ${activeMember.name}…`:"Select who you are above…"} style={{ flex:1, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:22, padding:"0.6rem 1rem", color:"#eee", fontFamily:"'Outfit',sans-serif", fontSize:14, outline:"none" }} />
        <button onClick={sendMessage} disabled={sending||!input.trim()} style={{ width:42, height:42, borderRadius:"50%", border:"none", cursor:"pointer", flexShrink:0, background:(!sending&&input.trim())?"#4D96FF":"rgba(77,150,255,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, color:"#fff" }}>➤</button>
      </div>
      <style>{`@keyframes bonce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}`}</style>
    </div>
  );
}

/* ══════════════════════════════════════
   MAIN APP
══════════════════════════════════════ */
export default function App() {
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  // payments: { id, txnKey (fromId-toId), amount, date }
  const [payments, setPayments] = useState([]);
  const [tab, setTab] = useState("members");
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [paymentModal, setPaymentModal] = useState(null); // { txn, debtorM, creditorM }
  const [reminderModal, setReminderModal] = useState(null); // txn
  const [memberForm, setMemberForm] = useState({ name:"", whatsapp:"" });
  const [expenseForm, setExpenseForm] = useState({ desc:"", amount:"", paidBy:"", category:CATEGORIES[0], splitAmong:[], date:"" });
  const [tripName, setTripName] = useState("My Trip");
  const [editingTrip, setEditingTrip] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, type="success") => { setToast({ msg, type }); setTimeout(()=>setToast(null), 2800); }, []);
  const getM = id => members.find(m=>m.id===id);

  /* ── members ── */
  const addMember = () => {
    if (!memberForm.name.trim()) return;
    setMembers(p=>[...p, { id:Date.now(), name:memberForm.name.trim(), whatsapp:memberForm.whatsapp.trim(), color:COLORS[p.length%COLORS.length] }]);
    setMemberForm({ name:"", whatsapp:"" });
    setShowAddMember(false);
    showToast(`${memberForm.name.trim()} added!`);
  };

  const removeMember = id => {
    setMembers(p=>p.filter(m=>m.id!==id));
    setExpenses(p=>p.filter(e=>e.paidBy!==id).map(e=>({...e,splitAmong:e.splitAmong.filter(s=>s!==id)})));
  };

  /* ── expenses ── */
  const openAddExpense = (prefill) => {
    if (members.length<2){ showToast("Add at least 2 members first!","error"); return; }
    setExpenseForm({ desc:prefill?.description||"", amount:prefill?.total||"", paidBy:members[0].id, category:CATEGORIES[0], splitAmong:members.map(m=>m.id), date:prefill?.date||new Date().toLocaleDateString("en-IN") });
    setShowAddExpense(true);
  };

  const addExpense = () => {
    const amt = parseFloat(expenseForm.amount);
    if (!expenseForm.desc.trim()||isNaN(amt)||amt<=0){ showToast("Fill all fields!","error"); return; }
    if (!expenseForm.paidBy){ showToast("Select who paid!","error"); return; }
    if (expenseForm.splitAmong.length===0){ showToast("Select at least 1 person!","error"); return; }
    setExpenses(p=>[...p,{ ...expenseForm, id:Date.now(), amount:amt, date:expenseForm.date||new Date().toLocaleDateString("en-IN") }]);
    setShowAddExpense(false);
    showToast("Expense added!");
  };

  const deleteExpense = id => { setExpenses(p=>p.filter(e=>e.id!==id)); showToast("Expense deleted"); };
  const toggleSplit = id => setExpenseForm(f=>({...f, splitAmong:f.splitAmong.includes(id)?f.splitAmong.filter(s=>s!==id):[...f.splitAmong,id]}));

  /* ── settlements ── */
  const settlements = useMemo(()=>{
    const memberSpend = {};
    members.forEach(m=>memberSpend[m.id]={paid:0,share:0});
    expenses.forEach(exp=>{
      if (memberSpend[exp.paidBy]) memberSpend[exp.paidBy].paid+=exp.amount;
      const share = exp.amount/exp.splitAmong.length;
      exp.splitAmong.forEach(pid=>{ if(memberSpend[pid]) memberSpend[pid].share+=share; });
    });

    const debtMap = {};
    members.forEach(m=>{ debtMap[m.id]={}; members.forEach(n=>{ debtMap[m.id][n.id]=0; }); });
    expenses.forEach(exp=>{
      const share = exp.amount/exp.splitAmong.length;
      exp.splitAmong.forEach(pid=>{
        if (pid!==exp.paidBy && debtMap[pid]?.[exp.paidBy]!==undefined) debtMap[pid][exp.paidBy]+=share;
      });
    });

    // subtract payments already made
    payments.forEach(pmt=>{
      const [fromId,toId] = pmt.txnKey.split("-");
      if (debtMap[fromId]?.[toId]!==undefined) debtMap[fromId][toId]=Math.max(0,debtMap[fromId][toId]-pmt.amount);
    });

    const txns=[];
    const visited=new Set();
    members.forEach(m=>{ members.forEach(n=>{
      if (m.id===n.id) return;
      const key=[m.id,n.id].sort().join("-");
      if (visited.has(key)) return; visited.add(key);
      const mOwesN=debtMap[m.id]?.[n.id]||0, nOwesM=debtMap[n.id]?.[m.id]||0;
      const net=mOwesN-nOwesM;
      if (net>0.01) txns.push({ from:m.id, to:n.id, amount:net, key:`${m.id}-${n.id}` });
      else if (net<-0.01) txns.push({ from:n.id, to:m.id, amount:-net, key:`${n.id}-${m.id}` });
    }); });

    const balance={};
    members.forEach(m=>balance[m.id]=(memberSpend[m.id]?.paid||0)-(memberSpend[m.id]?.share||0));
    return { txns, balance, memberSpend };
  },[expenses,members,payments]);

  /* ── payments ── */
  const recordPayment = (txn, amount) => {
    setPayments(p=>[...p,{ id:Date.now(), txnKey:txn.key, amount, date:new Date().toLocaleDateString("en-IN") }]);
    const debtorM = getM(txn.from), creditorM = getM(txn.to);
    showToast(`Payment of ₹${amount.toFixed(2)} recorded!`);
  };

  /* ── reminders ── */
  const waLink = (debtorM, creditorM, amount) => {
    const msg = `Hi ${debtorM.name}! 👋 Reminder for *${tripName}*: You owe *₹${amount.toFixed(2)}* to *${creditorM.name}*. Please settle up! 🙏`;
    return `https://wa.me/${debtorM.whatsapp.replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`;
  };

  const total = expenses.reduce((a,e)=>a+e.amount,0);

  const inputStyle = { width:"100%", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"0.7rem 0.9rem", color:"#fff", fontFamily:"'Outfit',sans-serif", fontSize:15, outline:"none", boxSizing:"border-box" };
  const labelStyle = { fontSize:11, color:"#555", fontWeight:700, display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:0.9 };

  const NavBtn = ({ id, label, icon }) => (
    <button onClick={()=>setTab(id)} style={{ flex:1, padding:"0.55rem 0", border:"none", cursor:"pointer", background:tab===id?"linear-gradient(135deg,#7C3AED,#10B981)":"transparent", color:tab===id?"#fff":"#555", borderRadius:10, fontFamily:"'Outfit',sans-serif", fontSize:11, fontWeight:700, transition:"all 0.2s", display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
      <span style={{ fontSize:18 }}>{icon}</span>{label}
    </button>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#0d0d1a", fontFamily:"'Outfit',sans-serif", color:"#e8e8f0", display:"flex", flexDirection:"column", alignItems:"center" }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Poppins:wght@700;800;900&display=swap" rel="stylesheet" />
      <Toast toast={toast} />

      <div style={{ width:"100%", maxWidth:480, display:"flex", flexDirection:"column", height:"100vh" }}>

        {/* ── HEADER ── */}
        <div style={{ background:"linear-gradient(160deg,#0f0f1e 0%,#1a1040 50%,#0d2010 100%)", padding:"1rem 1.4rem 1rem", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0 }}>
          {/* Splitify brand bar */}
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
            {/* SVG Logo inline */}
            <svg width="38" height="38" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="50" fill="url(#bg)"/>
              <path d="M50 5 A45 45 0 0 1 95 50 L50 50 Z" fill="url(#green)"/>
              <path d="M50 5 A45 45 0 0 0 5 50 L50 50 Z" fill="url(#purple)"/>
              <path d="M50 50 L5 50 A45 45 0 0 0 50 95 Z" fill="url(#purple2)"/>
              <path d="M50 50 L95 50 A45 45 0 0 1 50 95 Z" fill="url(#green2)"/>
              <text x="50" y="62" textAnchor="middle" fontSize="38" fontWeight="900" fill="white" fontFamily="Arial">S</text>
              <text x="30" y="55" textAnchor="middle" fontSize="14" fill="white">→</text>
              <text x="70" y="55" textAnchor="middle" fontSize="14" fill="white">←</text>
              <defs>
                <linearGradient id="purple" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#7C3AED"/><stop offset="1" stopColor="#6366F1"/></linearGradient>
                <linearGradient id="purple2" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#6366F1"/><stop offset="1" stopColor="#4F46E5"/></linearGradient>
                <linearGradient id="green" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#10B981"/><stop offset="1" stopColor="#34D399"/></linearGradient>
                <linearGradient id="green2" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#34D399"/><stop offset="1" stopColor="#6EE7B7"/></linearGradient>
                <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#7C3AED"/><stop offset="1" stopColor="#10B981"/></linearGradient>
              </defs>
            </svg>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:"'Poppins',sans-serif", fontWeight:900, fontSize:22, lineHeight:1, letterSpacing:-0.5 }}>
                <span style={{ color:"#1e1b4b" }}>Split</span><span style={{ color:"#10B981" }}>ify</span>
              </div>
              <div style={{ fontSize:10, color:"#555", fontWeight:600, letterSpacing:0.5 }}>Split expenses. Stay friends.</div>
            </div>
            {/* Trip name pill */}
            <div onClick={()=>setEditingTrip(true)} style={{ cursor:"pointer" }}>
              {editingTrip
                ? <input autoFocus value={tripName} onChange={e=>setTripName(e.target.value)} onBlur={()=>setEditingTrip(false)} onKeyDown={e=>e.key==="Enter"&&setEditingTrip(false)} style={{ background:"rgba(255,255,255,0.08)", border:"1px solid #10B981", color:"#fff", borderRadius:20, padding:"4px 12px", fontFamily:"'Outfit',sans-serif", fontSize:13, fontWeight:700, outline:"none", width:110 }} />
                : <div style={{ background:"rgba(16,185,129,0.12)", border:"1px solid rgba(16,185,129,0.3)", borderRadius:20, padding:"4px 12px", fontSize:12, fontWeight:700, color:"#10B981", display:"flex", alignItems:"center", gap:4, maxWidth:120 }}>
                    <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{tripName}</span>
                    <span style={{ fontSize:10 }}>✏️</span>
                  </div>
              }
            </div>
          </div>
          {/* Stats row */}
          <div style={{ display:"flex", gap:8 }}>
            {[{l:"TOTAL",v:`₹${total.toLocaleString("en-IN",{maximumFractionDigits:0})}`,c:"#818CF8"},{l:"MEMBERS",v:members.length,c:"#10B981"},{l:"EXPENSES",v:expenses.length,c:"#F59E0B"}].map(s=>(
              <div key={s.l} style={{ background:s.c+"14", borderRadius:10, padding:"0.4rem 0.8rem", border:`1px solid ${s.c}28`, flex:1 }}>
                <div style={{ fontSize:9, color:"#555", fontWeight:700, textTransform:"uppercase", letterSpacing:0.8 }}>{s.l}</div>
                <div style={{ fontSize:18, fontWeight:800, color:s.c }}>{s.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── CONTENT ── */}
        <div style={{ flex:1, overflow:tab==="chat"?"hidden":"auto", display:"flex", flexDirection:"column" }}>

          {/* MEMBERS TAB */}
          {tab==="members" && (
            <div style={{ padding:"1rem 1.2rem" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
                <h2 style={{ margin:0, fontSize:14, fontWeight:700, color:"#777", textTransform:"uppercase", letterSpacing:1 }}>👥 Members</h2>
                <button onClick={()=>setShowAddMember(true)} style={{ background:"linear-gradient(135deg,#7C3AED,#6366F1)", border:"none", color:"#fff", padding:"0.4rem 1rem", borderRadius:20, fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:13, cursor:"pointer" }}>+ Add</button>
              </div>
              {members.length===0 ? (
                <div style={{ textAlign:"center", padding:"3rem 1rem", color:"#444" }}>
                  <div style={{ fontSize:52 }}>👥</div>
                  <div style={{ fontWeight:600, marginTop:10 }}>No members yet</div>
                  <div style={{ fontSize:13, marginTop:4 }}>Add your travel buddies to get started</div>
                </div>
              ) : members.map(m=>(
                <div key={m.id} style={{ background:"#1a1a2e", borderRadius:14, padding:"0.9rem 1rem", marginBottom:"0.7rem", display:"flex", alignItems:"center", gap:12, border:"1px solid rgba(255,255,255,0.06)" }}>
                  <Avatar name={m.name} color={m.color} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:15 }}>{m.name}</div>
                    {m.whatsapp && <div style={{ fontSize:12, color:"#6BCB77", marginTop:2 }}>📱 {m.whatsapp}</div>}
                  </div>
                  <div style={{ textAlign:"right", marginRight:6 }}>
                    <div style={{ fontSize:10, color:"#444" }}>Paid</div>
                    <div style={{ fontWeight:700, color:"#4D96FF", fontSize:14 }}>₹{(settlements.memberSpend[m.id]?.paid||0).toFixed(0)}</div>
                  </div>
                  <button onClick={()=>removeMember(m.id)} style={{ background:"rgba(255,107,107,0.12)", border:"1px solid rgba(255,107,107,0.3)", color:"#FF6B6B", borderRadius:8, width:32, height:32, cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
                </div>
              ))}
            </div>
          )}

          {/* EXPENSES TAB */}
          {tab==="expenses" && (
            <div style={{ padding:"1rem 1.2rem" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
                <h2 style={{ margin:0, fontSize:14, fontWeight:700, color:"#777", textTransform:"uppercase", letterSpacing:1 }}>💸 Expenses</h2>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={()=>setShowScanner(true)} title="Scan Receipt" style={{ background:"rgba(199,125,255,0.15)", border:"1px solid rgba(199,125,255,0.3)", color:"#C77DFF", padding:"0.4rem 0.8rem", borderRadius:20, fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:13, cursor:"pointer" }}>📷 Scan</button>
                  <button onClick={()=>openAddExpense()} style={{ background:"#FF6B6B", border:"none", color:"#fff", padding:"0.4rem 0.9rem", borderRadius:20, fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:13, cursor:"pointer" }}>+ Add</button>
                </div>
              </div>
              {expenses.length===0 ? (
                <div style={{ textAlign:"center", padding:"3rem 1rem", color:"#444" }}>
                  <div style={{ fontSize:52 }}>🧾</div>
                  <div style={{ fontWeight:600, marginTop:10 }}>No expenses yet</div>
                  <div style={{ fontSize:13, marginTop:4 }}>Add manually or scan a receipt 📷</div>
                </div>
              ) : expenses.map(exp=>{
                const payer = getM(exp.paidBy);
                return (
                  <div key={exp.id} style={{ background:"#1a1a2e", borderRadius:14, padding:"1rem", marginBottom:"0.7rem", border:"1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                      <div style={{ flex:1 }}>
                        <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:6, flexWrap:"wrap" }}>
                          <Tag label={exp.category} color="#4D96FF" />
                          <span style={{ fontSize:11, color:"#444" }}>{exp.date}</span>
                        </div>
                        <div style={{ fontWeight:700, fontSize:15, marginBottom:4 }}>{exp.desc}</div>
                        <div style={{ fontSize:12, color:"#666" }}>
                          Paid by <span style={{ color:payer?.color, fontWeight:600 }}>{payer?.name}</span>
                          {" · "}₹{(exp.amount/exp.splitAmong.length).toFixed(2)}/person
                        </div>
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 }}>
                        <div style={{ fontWeight:800, fontSize:18, color:"#FFD93D" }}>₹{exp.amount.toLocaleString("en-IN")}</div>
                        <button onClick={()=>{ if(window.confirm("Delete this expense?")) deleteExpense(exp.id); }} style={{ background:"rgba(255,107,107,0.1)", border:"1px solid rgba(255,107,107,0.25)", color:"#FF6B6B", borderRadius:7, padding:"2px 8px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"'Outfit',sans-serif" }}>🗑 Delete</button>
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:5, marginTop:10, flexWrap:"wrap" }}>
                      {exp.splitAmong.map(id=>{ const m=getM(id); return m?(<div key={id} style={{ display:"flex", alignItems:"center", gap:4, background:"rgba(255,255,255,0.04)", borderRadius:20, padding:"2px 8px" }}><Avatar name={m.name} color={m.color} size={16} /><span style={{ fontSize:11, color:"#777" }}>{m.name}</span></div>):null; })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* SUMMARY TAB */}
          {tab==="summary" && (
            <div style={{ padding:"1rem 1.2rem" }}>
              <h2 style={{ margin:"0 0 1rem", fontSize:14, fontWeight:700, color:"#777", textTransform:"uppercase", letterSpacing:1 }}>📊 Summary & Settlements</h2>
              {members.length===0 ? (
                <div style={{ textAlign:"center", padding:"3rem 1rem", color:"#444" }}>
                  <div style={{ fontSize:52 }}>📊</div>
                  <div style={{ fontWeight:600, marginTop:10 }}>Add members & expenses first</div>
                </div>
              ) : (
                <>
                  {/* Per person */}
                  <div style={{ fontSize:11, color:"#444", fontWeight:700, marginBottom:"0.6rem", textTransform:"uppercase", letterSpacing:1 }}>Per Person Breakdown</div>
                  {members.map(m=>{
                    const d = settlements.memberSpend[m.id]||{paid:0,share:0};
                    const net = d.paid - d.share;
                    const owedBy = settlements.txns.filter(t=>t.to===m.id);
                    const owesTo = settlements.txns.filter(t=>t.from===m.id);
                    return (
                      <div key={m.id} style={{ background:"#1a1a2e", borderRadius:14, padding:"1rem", marginBottom:"0.7rem", border:`1.5px solid ${net>0.01?"rgba(107,203,119,0.3)":net<-0.01?"rgba(255,107,107,0.3)":"rgba(255,255,255,0.07)"}` }}>
                        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:(owedBy.length||owesTo.length)?"0.8rem":0 }}>
                          <Avatar name={m.name} color={m.color} size={38} />
                          <div style={{ flex:1 }}>
                            <div style={{ fontWeight:800, fontSize:15 }}>{m.name}</div>
                            <div style={{ fontSize:12, color:"#555", marginTop:2 }}>Paid ₹{d.paid.toFixed(2)} · Share ₹{d.share.toFixed(2)}</div>
                          </div>
                          <div style={{ textAlign:"right" }}>
                            <div style={{ fontSize:10, color:"#555", fontWeight:600 }}>{net>0.01?"TO RECEIVE":net<-0.01?"TO PAY":"SETTLED"}</div>
                            <div style={{ fontWeight:900, fontSize:17, color:net>0.01?"#6BCB77":net<-0.01?"#FF6B6B":"#555" }}>
                              {net>0.01?`₹${net.toFixed(2)}`:net<-0.01?`₹${Math.abs(net).toFixed(2)}`:"✓"}
                            </div>
                          </div>
                        </div>
                        {owedBy.length>0 && (
                          <div style={{ background:"rgba(107,203,119,0.06)", border:"1px solid rgba(107,203,119,0.15)", borderRadius:10, padding:"0.5rem 0.8rem", marginBottom:owesTo.length?"0.5rem":0 }}>
                            <div style={{ fontSize:10, color:"#6BCB77", fontWeight:700, marginBottom:4, textTransform:"uppercase", letterSpacing:0.8 }}>💰 Gets from</div>
                            {owedBy.map((t,i)=>{ const debtor=getM(t.from); return debtor?(<div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"3px 0" }}><div style={{ display:"flex", alignItems:"center", gap:6 }}><Avatar name={debtor.name} color={debtor.color} size={20} /><span style={{ fontSize:13, color:"#ccc", fontWeight:600 }}>{debtor.name}</span></div><span style={{ fontSize:14, fontWeight:800, color:"#6BCB77" }}>₹{t.amount.toFixed(2)}</span></div>):null; })}
                          </div>
                        )}
                        {owesTo.length>0 && (
                          <div style={{ background:"rgba(255,107,107,0.06)", border:"1px solid rgba(255,107,107,0.15)", borderRadius:10, padding:"0.5rem 0.8rem" }}>
                            <div style={{ fontSize:10, color:"#FF6B6B", fontWeight:700, marginBottom:4, textTransform:"uppercase", letterSpacing:0.8 }}>🔴 Owes to</div>
                            {owesTo.map((t,i)=>{ const cred=getM(t.to); return cred?(<div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"3px 0" }}><div style={{ display:"flex", alignItems:"center", gap:6 }}><Avatar name={cred.name} color={cred.color} size={20} /><span style={{ fontSize:13, color:"#ccc", fontWeight:600 }}>{cred.name}</span></div><span style={{ fontSize:14, fontWeight:800, color:"#FF6B6B" }}>₹{t.amount.toFixed(2)}</span></div>):null; })}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Settlement cards */}
                  <div style={{ fontSize:11, color:"#444", fontWeight:700, margin:"1rem 0 0.6rem", textTransform:"uppercase", letterSpacing:1 }}>Settlement Transactions</div>
                  {settlements.txns.length===0 ? (
                    <div style={{ background:"rgba(107,203,119,0.07)", border:"1px solid rgba(107,203,119,0.18)", borderRadius:12, padding:"1rem", textAlign:"center" }}>
                      <div style={{ fontSize:26 }}>🎉</div>
                      <div style={{ color:"#6BCB77", fontWeight:700, marginTop:4 }}>All settled up!</div>
                    </div>
                  ) : settlements.txns.map((t,i)=>{
                    const debtorM=getM(t.from), creditorM=getM(t.to);
                    if(!debtorM||!creditorM) return null;
                    return (
                      <div key={i} style={{ background:"linear-gradient(135deg,#1a1a2e,#16213e)", borderRadius:16, padding:"1.2rem", marginBottom:"0.9rem", border:"1px solid rgba(255,107,107,0.2)", boxShadow:"0 4px 20px rgba(255,107,107,0.07)" }}>
                        {/* Arrow row */}
                        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:"1rem" }}>
                          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5, minWidth:64 }}>
                            <Avatar name={debtorM.name} color={debtorM.color} size={44} />
                            <span style={{ fontSize:12, fontWeight:700, color:debtorM.color, maxWidth:70, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{debtorM.name}</span>
                          </div>
                          <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                            <div style={{ fontWeight:900, fontSize:22, color:"#FF6B6B" }}>₹{t.amount.toFixed(2)}</div>
                            <div style={{ display:"flex", alignItems:"center", gap:4, width:"100%" }}>
                              <div style={{ flex:1, height:2, background:"linear-gradient(90deg,#FF6B6B,#FFD93D)" }} />
                              <span style={{ fontSize:18, color:"#FFD93D" }}>➤</span>
                            </div>
                            <div style={{ fontSize:11, color:"#555", fontWeight:600 }}>PAYS TO</div>
                          </div>
                          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5, minWidth:64 }}>
                            <Avatar name={creditorM.name} color={creditorM.color} size={44} />
                            <span style={{ fontSize:12, fontWeight:700, color:creditorM.color, maxWidth:70, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{creditorM.name}</span>
                          </div>
                        </div>

                        {/* Summary line */}
                        <div style={{ background:"rgba(255,107,107,0.07)", border:"1px solid rgba(255,107,107,0.14)", borderRadius:10, padding:"0.55rem 0.9rem", fontSize:13, color:"#ccc", marginBottom:"0.9rem", textAlign:"center", lineHeight:1.5 }}>
                          <span style={{ color:debtorM.color, fontWeight:700 }}>{debtorM.name}</span> must pay <span style={{ color:"#FFD93D", fontWeight:800 }}>₹{t.amount.toFixed(2)}</span> to <span style={{ color:creditorM.color, fontWeight:700 }}>{creditorM.name}</span>
                        </div>

                        {/* Actions row */}
                        <div style={{ display:"flex", gap:8 }}>
                          {/* Mark paid / partial */}
                          <button onClick={()=>setPaymentModal({txn:t, debtorM, creditorM})} style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5, background:"rgba(107,203,119,0.12)", border:"1px solid rgba(107,203,119,0.3)", color:"#6BCB77", borderRadius:10, padding:"0.5rem", fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:12, cursor:"pointer" }}>
                            ✅ Mark Paid
                          </button>
                          {/* WhatsApp reminder */}
                          {debtorM.whatsapp ? (
                            <a href={waLink(debtorM, creditorM, t.amount)} target="_blank" rel="noreferrer" style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5, background:"rgba(37,211,102,0.1)", border:"1px solid rgba(37,211,102,0.25)", color:"#25D366", borderRadius:10, padding:"0.5rem", textDecoration:"none", fontWeight:700, fontSize:12, fontFamily:"'Outfit',sans-serif" }}>
                              💬 Remind
                            </a>
                          ) : (
                            <button onClick={()=>showToast(`${debtorM.name} has no WhatsApp number`,"error")} style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", color:"#555", borderRadius:10, padding:"0.5rem", fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:12, cursor:"pointer" }}>
                              💬 Remind
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Payment history */}
                  {payments.length>0 && (
                    <>
                      <div style={{ fontSize:11, color:"#444", fontWeight:700, margin:"1rem 0 0.6rem", textTransform:"uppercase", letterSpacing:1 }}>Payment History</div>
                      {payments.map(pmt=>{
                        const [fromId,toId]=pmt.txnKey.split("-");
                        const fromM=getM(fromId), toM=getM(toId);
                        return fromM&&toM ? (
                          <div key={pmt.id} style={{ background:"rgba(107,203,119,0.05)", border:"1px solid rgba(107,203,119,0.15)", borderRadius:12, padding:"0.7rem 1rem", marginBottom:"0.5rem", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                            <div style={{ fontSize:13, color:"#aaa" }}>
                              <span style={{ color:fromM.color, fontWeight:700 }}>{fromM.name}</span> → <span style={{ color:toM.color, fontWeight:700 }}>{toM.name}</span>
                              <span style={{ fontSize:11, color:"#444", marginLeft:8 }}>{pmt.date}</span>
                            </div>
                            <span style={{ fontWeight:800, color:"#6BCB77", fontSize:14 }}>₹{pmt.amount.toFixed(2)}</span>
                          </div>
                        ) : null;
                      })}
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* CHAT TAB */}
          {tab==="chat" && <ChatTab members={members} tripName={tripName} expenses={expenses} />}
        </div>

        {/* ── BOTTOM NAV ── */}
        <div style={{ background:"#0f0f1e", borderTop:"1px solid rgba(124,58,237,0.2)", padding:"0.4rem 0.5rem", display:"flex", gap:3, flexShrink:0 }}>
          <NavBtn id="members" label="Members" icon="👥" />
          <NavBtn id="expenses" label="Expenses" icon="💸" />
          <NavBtn id="summary" label="Summary" icon="📊" />
          <NavBtn id="chat" label="Chat" icon="💬" />
        </div>
      </div>

      {/* ── MODALS ── */}

      {showAddMember && (
        <Modal onClose={()=>setShowAddMember(false)}>
          <h2 style={{ margin:"0 0 1.2rem", fontWeight:800, fontSize:20 }}>👤 Add Member</h2>
          {[{label:"Name *",key:"name",placeholder:"e.g. Rahul",type:"text"},{label:"WhatsApp Number",key:"whatsapp",placeholder:"+91 9876543210",type:"tel"}].map(f=>(
            <div key={f.key} style={{ marginBottom:"1rem" }}>
              <label style={labelStyle}>{f.label}</label>
              <input value={memberForm[f.key]} onChange={e=>setMemberForm(p=>({...p,[f.key]:e.target.value}))} placeholder={f.placeholder} type={f.type} onKeyDown={e=>e.key==="Enter"&&addMember()} style={inputStyle} />
            </div>
          ))}
          <div style={{ fontSize:11, color:"#444", marginBottom:"1.2rem" }}>WhatsApp number is used to send payment reminders</div>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={()=>setShowAddMember(false)} style={{ flex:1, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#666", borderRadius:12, padding:"0.7rem", fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:14, cursor:"pointer" }}>Cancel</button>
            <button onClick={addMember} style={{ flex:2, background:"linear-gradient(135deg,#7C3AED,#10B981)", border:"none", color:"#fff", borderRadius:12, padding:"0.7rem", fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:14, cursor:"pointer" }}>Add Member</button>
          </div>
        </Modal>
      )}

      {showAddExpense && (
        <Modal onClose={()=>setShowAddExpense(false)}>
          <h2 style={{ margin:"0 0 1.2rem", fontWeight:800, fontSize:20 }}>💸 Add Expense</h2>
          <div style={{ marginBottom:"1rem" }}>
            <label style={labelStyle}>Description *</label>
            <input value={expenseForm.desc} onChange={e=>setExpenseForm(f=>({...f,desc:e.target.value}))} placeholder="e.g. Dinner at hotel" style={inputStyle} />
          </div>
          <div style={{ marginBottom:"1rem" }}>
            <label style={labelStyle}>Amount (₹) *</label>
            <input value={expenseForm.amount} onChange={e=>setExpenseForm(f=>({...f,amount:e.target.value}))} placeholder="0.00" type="number" style={inputStyle} />
          </div>
          <div style={{ marginBottom:"1rem" }}>
            <label style={labelStyle}>Date</label>
            <input value={expenseForm.date} onChange={e=>setExpenseForm(f=>({...f,date:e.target.value}))} placeholder="DD/MM/YYYY" style={inputStyle} />
          </div>
          <div style={{ marginBottom:"1rem" }}>
            <label style={labelStyle}>Category</label>
            <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
              {CATEGORIES.map(cat=>(<button key={cat} onClick={()=>setExpenseForm(f=>({...f,category:cat}))} style={{ background:expenseForm.category===cat?"rgba(77,150,255,0.2)":"rgba(255,255,255,0.04)", border:`1px solid ${expenseForm.category===cat?"#4D96FF":"rgba(255,255,255,0.1)"}`, color:expenseForm.category===cat?"#4D96FF":"#777", borderRadius:8, padding:"4px 10px", fontSize:12, cursor:"pointer", fontFamily:"'Outfit',sans-serif", fontWeight:600 }}>{cat}</button>))}
            </div>
          </div>
          <div style={{ marginBottom:"1rem" }}>
            <label style={labelStyle}>Paid By *</label>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {members.map(m=>(<button key={m.id} onClick={()=>setExpenseForm(f=>({...f,paidBy:m.id}))} style={{ display:"flex", alignItems:"center", gap:6, background:expenseForm.paidBy===m.id?m.color+"22":"rgba(255,255,255,0.04)", border:`1px solid ${expenseForm.paidBy===m.id?m.color:"rgba(255,255,255,0.1)"}`, color:expenseForm.paidBy===m.id?m.color:"#777", borderRadius:20, padding:"4px 12px", fontSize:13, cursor:"pointer", fontFamily:"'Outfit',sans-serif", fontWeight:600 }}><Avatar name={m.name} color={m.color} size={20} />{m.name}</button>))}
            </div>
          </div>
          <div style={{ marginBottom:"1.2rem" }}>
            <label style={labelStyle}>Split Among *</label>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {members.map(m=>{ const on=expenseForm.splitAmong.includes(m.id); return (<button key={m.id} onClick={()=>toggleSplit(m.id)} style={{ display:"flex", alignItems:"center", gap:6, background:on?m.color+"22":"rgba(255,255,255,0.04)", border:`1px solid ${on?m.color:"rgba(255,255,255,0.1)"}`, color:on?m.color:"#777", borderRadius:20, padding:"4px 12px", fontSize:13, cursor:"pointer", fontFamily:"'Outfit',sans-serif", fontWeight:600 }}><Avatar name={m.name} color={m.color} size={20} />{m.name}{on?" ✓":""}</button>); })}
            </div>
            {expenseForm.splitAmong.length>0&&expenseForm.amount&&(<div style={{ fontSize:12, color:"#4D96FF", marginTop:6, fontWeight:600 }}>₹{(parseFloat(expenseForm.amount||0)/expenseForm.splitAmong.length).toFixed(2)} per person</div>)}
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={()=>setShowAddExpense(false)} style={{ flex:1, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#666", borderRadius:12, padding:"0.7rem", fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:14, cursor:"pointer" }}>Cancel</button>
            <button onClick={addExpense} style={{ flex:2, background:"#FF6B6B", border:"none", color:"#fff", borderRadius:12, padding:"0.7rem", fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:14, cursor:"pointer" }}>Add Expense</button>
          </div>
        </Modal>
      )}

      {showScanner && (
        <ReceiptScanner
          onClose={()=>setShowScanner(false)}
          onExtracted={data=>{ setShowScanner(false); openAddExpense(data); }}
        />
      )}

      {paymentModal && (
        <PaymentModal
          txn={paymentModal.txn}
          debtorM={paymentModal.debtorM}
          creditorM={paymentModal.creditorM}
          onClose={()=>setPaymentModal(null)}
          onPayment={recordPayment}
        />
      )}
    </div>
  );
}
