require('dotenv').config();
const express=require('express'), fs=require('fs'), path=require('path');
const app=express(); app.use(express.json({limit:'1mb'}));
// Protect the office with HTTP Basic Authentication when OFFICE_PASSWORD is configured.
app.use((req,res,next)=>{if(!process.env.OFFICE_PASSWORD)return next();const h=req.headers.authorization||'',m=h.match(/^Basic (.+)$/);if(m){try{const [user,pass]=Buffer.from(m[1],'base64').toString().split(':');if(user==='office'&&pass===process.env.OFFICE_PASSWORD)return next();}catch{}}res.set('WWW-Authenticate','Basic realm=AI Office');res.status(401).send('Authentication required');});
app.use(express.static(path.join(__dirname,'public')));
const DATA_DIR=path.join(__dirname,'data'), TASKS=path.join(DATA_DIR,'tasks.json'), CHATS=path.join(DATA_DIR,'chats.json');
if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR,{recursive:true});
function readJSON(p,def){try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return def}}
function writeJSON(p,v){fs.writeFileSync(p,JSON.stringify(v,null,2))}
const agents=[
{id:'ceo',name:'المدير العام',emoji:'👔',room:'الإدارة',role:'إدارة الشركة، صياغة الأهداف، توزيع الأعمال، تلخيص نتائج الأقسام، ومراجعة الأولويات.',prompt:'أنت المدير التنفيذي لشركة افتراضية. خطط ونسق، وميّز بوضوح بين المقترحات والأعمال المنفذة. لا تدّع إرسال رسائل أو إجراء عمليات خارجية لم تنفذها.'},
{id:'research',name:'الباحث الدولي',emoji:'🔎',room:'البحث الدولي',role:'اكتشاف فرص دعم وتمويل ومبادرات وأعمال دولية، والتحقق من شروطها ومصادرها.',prompt:'أنت باحث فرص دولية. ركز على جهات وأفراد خارج الأردن. تحقق من المصدر وشروط الأهلية والتاريخ والطرق الرسمية. لا تخترع فرصًا أو تفاصيل.'},
{id:'communication',name:'مسؤول التواصل',emoji:'✉️',room:'العلاقات',role:'إعداد المراسلات، متابعة الجهات، منع التكرار، وإدارة مسودات التواصل.',prompt:'أنت مسؤول التواصل. جهز رسائل محترمة ومخصصة، تحقق من سياق التواصل والتكرار. لا تدّع إرسال أي رسالة دون أداة إرسال فعلية.'},
{id:'finance',name:'المحلل المالي',emoji:'📊',room:'المالية',role:'تحليل الميزانيات والمشاريع والتكاليف والمخاطر وتقديرات العائد.',prompt:'أنت محلل مالي. افصل البيانات الفعلية عن الافتراضات والتوقعات، ووضح المخاطر ولا تقدم وعودًا.'},
{id:'marketing',name:'مدير التسويق',emoji:'🎨',room:'التسويق',role:'تخطيط الحملات، كتابة المحتوى، تحليل الأسواق، وتطوير أفكار تسويق.',prompt:'أنت مدير التسويق. قدم خططًا قابلة للتنفيذ ومقاييس متابعة ونسخًا إبداعية.'},
{id:'income',name:'مستكشف الدخل',emoji:'🚀',room:'فرص الدخل',role:'اكتشاف مصادر دخل مشروعة وفرص عمل وخدمات ومشاريع.',prompt:'أنت مستكشف مصادر دخل. ابحث عن خيارات قانونية واقعية، ورتبها حسب الوقت والكلفة والجدوى والمخاطر.'},
{id:'operations',name:'مدير العمليات',emoji:'🗂️',room:'العمليات',role:'إدارة المهام، مراقبة الإنجاز، إعداد التقارير، واكتشاف التعطيل.',prompt:'أنت مدير العمليات. نظم المهام، وقدم مؤشرات واضحة، ولا تزعم تشغيل عمليات لم تتم.'},
{id:'innovation',name:'مسؤول الابتكار',emoji:'💡',room:'الابتكار',role:'تطوير الأفكار، تجربة حلول جديدة، وتحليل قابلية التنفيذ.',prompt:'أنت مسؤول الابتكار. قدم أفكارًا قابلة للاختبار، مراحل، ومخاطر وبدائل.'}
];
app.get('/api/status',(req,res)=>res.json({configured:!!process.env.AI_API_KEY,model:process.env.AI_MODEL||'not configured',agentCount:agents.length}));
app.get('/api/agents',(req,res)=>res.json(agents.map(({prompt,...a})=>a)));
app.get('/api/tasks',(req,res)=>res.json(readJSON(TASKS,[])));
app.post('/api/tasks',(req,res)=>{let {agentId,title,description}=req.body||{};if(!agents.some(a=>a.id===agentId)||!title)return res.status(400).json({error:'agentId and title are required'});let tasks=readJSON(TASKS,[]);let t={id:Date.now().toString(),agentId,title,description:description||'',status:'queued',createdAt:new Date().toISOString()};tasks.unshift(t);writeJSON(TASKS,tasks);res.json(t)});
app.patch('/api/tasks/:id',(req,res)=>{let tasks=readJSON(TASKS,[]),i=tasks.findIndex(t=>t.id===req.params.id);if(i<0)return res.status(404).json({error:'Task not found'});tasks[i]={...tasks[i],...req.body,updatedAt:new Date().toISOString()};writeJSON(TASKS,tasks);res.json(tasks[i])});
app.delete('/api/tasks/:id',(req,res)=>{let tasks=readJSON(TASKS,[]).filter(t=>t.id!==req.params.id);writeJSON(TASKS,tasks);res.json({ok:true})});
app.get('/api/chat/:agentId',(req,res)=>{let chats=readJSON(CHATS,{});res.json(chats[req.params.agentId]||[])});
app.post('/api/chat/:agentId',async(req,res)=>{let agent=agents.find(a=>a.id===req.params.agentId);if(!agent)return res.status(404).json({error:'Agent not found'});let {message}=req.body||{};if(!message)return res.status(400).json({error:'Message is required'});if(!process.env.AI_API_KEY)return res.status(503).json({error:'لم يتم إعداد مفتاح AI_API_KEY في ملف .env بعد.'});
let chats=readJSON(CHATS,{}), history=chats[agent.id]||[];
try{
const payload={model:process.env.AI_MODEL||'gpt-6',messages:[{role:'system',content:agent.prompt},...history.slice(-16),{role:'user',content:message}]};
const base=(process.env.AI_BASE_URL||'https://api.openai.com/v1').replace(/\/$/,'');
const resp=await fetch(base+'/chat/completions',{method:'POST',headers:{'Authorization':'Bearer '+process.env.AI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify(payload)});
const data=await resp.json();if(!resp.ok)throw new Error(data.error?.message||('API error '+resp.status));
const reply=data.choices?.[0]?.message?.content||'لم يصل نص رد.';
history.push({role:'user',content:message},{role:'assistant',content:reply});chats[agent.id]=history.slice(-40);writeJSON(CHATS,chats);res.json({reply});
}catch(e){res.status(500).json({error:'تعذر تنفيذ المحادثة: '+e.message})}});
app.post('/api/manager/plan',async(req,res)=>{if(!process.env.AI_API_KEY)return res.status(503).json({error:'قم بإعداد AI_API_KEY أولاً'});const goal=req.body?.goal;if(!goal)return res.status(400).json({error:'goal required'});try{const base=(process.env.AI_BASE_URL||'https://api.openai.com/v1').replace(/\/$/,'');const messages=[{role:'system',content:'أنت المدير التنفيذي. وزع الهدف إلى مهام واضحة على الأقسام التالية باستخدام JSON فقط: ceo, research, communication, finance, marketing, income, operations, innovation. أخرج JSON بالشكل {"plan":[{"agentId":"research","title":"...","description":"..."}]} لا تسند رسائل خارجية دون موافقة ولا تخترع تنفيذ.'},{role:'user',content:goal}];const r=await fetch(base+'/chat/completions',{method:'POST',headers:{'Authorization':'Bearer '+process.env.AI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.AI_MODEL||'gpt-6',messages})});const d=await r.json();if(!r.ok)throw Error(d.error?.message||r.status);let raw=d.choices[0].message.content;raw=raw.replace(/^```(?:json)?/,'').replace(/```$/,'').trim();let plan=JSON.parse(raw);let tasks=readJSON(TASKS,[]);(plan.plan||[]).forEach(p=>tasks.unshift({id:(Date.now()+Math.random()).toString(),agentId:p.agentId,title:p.title,description:p.description||'',status:'queued',createdAt:new Date().toISOString(),source:'manager-plan'}));writeJSON(TASKS,tasks);res.json(plan)}catch(e){res.status(500).json({error:'تعذر إعداد الخطة: '+e.message})}});
const port=process.env.PORT||3000;app.listen(port,()=>console.log('AI Office running on http://localhost:'+port));