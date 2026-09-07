import React, {useEffect, useRef, useState} from "react";
import {createRoot} from "react-dom/client";
import {BookOpen, CheckCircle2, CircleAlert, Clock3, FileText, FolderOpen, LayoutDashboard, Plus, Search, CalendarDays, Trash2, Pencil, X, Upload, Download, ChevronRight, LockKeyhole, ArrowRight, Eye, EyeOff, LogOut, GripVertical, Menu} from "lucide-react";
import {supabase} from "./lib/supabase";
import {renderAsync as renderDocx} from "docx-preview";
import "./styles.css";
import "./subjectStyles.css";
import "./responsive.css";

const seedSubjects = [{id: "s1", name: "Business Finance", code: "FIN 101", color: "#2563eb"}, {id: "s2", name: "Web Development", code: "IT 201", color: "#7c3aed"}];
const seedItems = [{id: "i1", subjectId: "s1", category: "Module", title: "Module 1 – Introduction to Business Finance", description: "Read the module and review the examples.", deadline: "2026-09-10", priority: "High", status: "Pending", files: []}, {id: "i2", subjectId: "s1", category: "Activity", title: "Activity 1 – Financial Decisions", description: "Answer the guide questions.", deadline: "2026-09-12", priority: "Medium", status: "Pending", files: []}, {id: "i3", subjectId: "s2", category: "Task", title: "HTML/CSS Practice", description: "Create the required webpage.", deadline: "2026-09-18", priority: "High", status: "Pending", files: []}];

const DEFAULT_SECTION = {id: "default-section", name: "My Subjects", sortOrder: 0};
const mapSection = row => ({id: row.id, name: row.name, sortOrder: row.sort_order});
const mapSubject = row => ({id: row.id, name: row.name, code: row.code, color: row.color, instructor: row.instructor || "", sectionId: row.section_id, sortOrder: row.sort_order});
const mapItem = row => ({id: row.id, subjectId: row.subject_id, category: row.category, title: row.title, description: row.description || "", deadline: row.deadline, priority: row.priority, status: row.status, submittedAt: row.submitted_at, files: row.files || []});
const normalizeSectionState = (sectionRows, subjectRows) => {
  const resolvedSections = sectionRows && sectionRows.length ? sectionRows.map(mapSection) : [{...DEFAULT_SECTION}];
  const fallbackSectionId = resolvedSections[0]?.id || DEFAULT_SECTION.id;
  const normalizedSubjects = (subjectRows || []).map(row => {
    const subject = mapSubject(row);
    return {...subject, sectionId: subject.sectionId || fallbackSectionId, sortOrder: Number.isFinite(subject.sortOrder) ? subject.sortOrder : 0};
  });
  return {sections: resolvedSections, subjects: normalizedSubjects};
};

function App() {
  const Login = LoginWithAccounts;
  const [accountUsername, setAccountUsername] = useState(() => localStorage.getItem("studyflow-account") || "");
  const [authenticated, setAuthenticated] = useState(() => Boolean(localStorage.getItem("studyflow-account")));
  const [subjects, setSubjects] = useState([]);
  const [sections, setSections] = useState([]);
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState("dashboard");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dataError, setDataError] = useState("");
  const [previewFile, setPreviewFile] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!authenticated || !accountUsername) return;
    let active = true;
    const loadData = async () => {
      setLoading(true);
      const [sectionResult, subjectResult, itemResult] = await Promise.all([
        supabase.from("subject_sections").select("*").eq("account_username", accountUsername).order("sort_order"),
        supabase.from("subjects").select("*").eq("account_username", accountUsername).order("sort_order"),
        supabase.from("requirements").select("*").eq("account_username", accountUsername).order("deadline")
      ]);
      if (!active) return;
      if (sectionResult.error || subjectResult.error || itemResult.error) setDataError(sectionResult.error?.message || subjectResult.error?.message || itemResult.error?.message || "Could not load your workspace.");
      else {
        const normalized = normalizeSectionState(sectionResult.data, subjectResult.data);
        setSections(normalized.sections);
        setSubjects(normalized.subjects);
        setItems(itemResult.data.map(mapItem));
      }
      setLoading(false);
    };
    loadData();
    return () => { active = false; };
  }, [authenticated, accountUsername]);

  useEffect(() => {
    const previewAttachment = event => {
      const button = event.target.closest(".attachment button");
      if (!button || !button.querySelector("svg")?.getAttribute("class")?.includes("lucide-eye")) return;
      if (button.getAttribute("aria-label")?.startsWith("View ") === false) return;
      const attachment = button.closest(".attachment");
      const item = attachment?.querySelector("span")?.title;
      const file = items.flatMap(requirement => requirement.files || []).find(attachmentFile => attachmentFile.name === item);
      if (!file?.dataUrl) return;
      event.preventDefault();
      event.stopPropagation();
      const [header, encoded] = file.dataUrl.split(",");
      const binary = atob(encoded);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      const blobUrl = URL.createObjectURL(new Blob([bytes], {type: file.type || header.match(/data:(.*?);/)?.[1] || "application/octet-stream"}));
      setPreviewFile({...file, previewUrl: blobUrl});
    };
    document.addEventListener("click", previewAttachment, true);
    return () => document.removeEventListener("click", previewAttachment, true);
  }, [items]);

  const allItems = items.map(item => ({...item, subject: subjects.find(subject => subject.id === item.subjectId)?.name || "Unknown"}));
  const stats = {subjects: subjects.length, total: items.length, pending: items.filter(item => item.status === "Pending").length, submitted: items.filter(item => item.status === "Submitted").length, overdue: items.filter(item => item.status === "Pending" && daysLeft(item.deadline) < 0).length};
  const filtered = allItems.filter(item => (selected === "dashboard" || item.subjectId === selected) && (item.title + " " + item.description + " " + item.category + " " + item.subject).toLowerCase().includes(query.toLowerCase()));

  const submit = async id => {
    const submittedAt = new Date().toISOString();
    const {data, error} = await supabase.from("requirements").update({status: "Submitted", submitted_at: submittedAt}).eq("id", id).eq("account_username", accountUsername).select().single();
    if (error) return setDataError(error.message);
    setItems(current => current.map(item => item.id === id ? mapItem(data) : item));
  };
  const remove = async id => {
    if (!confirm("Delete this requirement?")) return;
    const {error} = await supabase.from("requirements").delete().eq("id", id).eq("account_username", accountUsername);
    if (error) return setDataError(error.message);
    setItems(current => current.filter(item => item.id !== id));
  };
  const saveSubject = async form => {
    const fallbackSectionId = sections[0]?.id || DEFAULT_SECTION.id;
    const sectionId = form.sectionId || fallbackSectionId;
    const payload = {account_username: accountUsername, name: form.name.trim(), code: form.code.trim() || null, color: form.color, instructor: form.instructor.trim() || null, section_id: sectionId, sort_order: form.sortOrder ?? subjects.filter(subject => subject.sectionId === sectionId).length};
    const result = form.id ? await supabase.from("subjects").update(payload).eq("id", form.id).eq("account_username", accountUsername).select().single() : await supabase.from("subjects").insert(payload).select().single();
    if (result.error) throw new Error(result.error.message);
    const subject = mapSubject(result.data);
    const nextSubject = {...subject, sectionId: subject.sectionId || fallbackSectionId, sortOrder: Number.isFinite(subject.sortOrder) ? subject.sortOrder : 0};
    setSubjects(current => form.id ? current.map(item => item.id === form.id ? nextSubject : item) : [...current, nextSubject]);
  };
  const renameSection = async (section, name) => {
    const cleanName = name.trim();
    if (!cleanName || cleanName === section.name) return;
    const {error} = await supabase.from("subject_sections").update({name: cleanName}).eq("id", section.id).eq("account_username", accountUsername);
    if (error) return setDataError(error.message);
    setSections(current => current.map(item => item.id === section.id ? {...item, name: cleanName} : item));
  };
  const moveSubject = async (subjectId, sectionId, beforeSubjectId = null) => {
    const moving = subjects.find(subject => subject.id === subjectId);
    if (!moving) return;
    const nextSubjects = subjects.filter(subject => subject.id !== subjectId);
    const sectionSubjects = nextSubjects.filter(subject => subject.sectionId === sectionId).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    const insertAt = beforeSubjectId ? sectionSubjects.findIndex(subject => subject.id === beforeSubjectId) : sectionSubjects.length;
    sectionSubjects.splice(insertAt < 0 ? sectionSubjects.length : insertAt, 0, {...moving, sectionId});
    const updates = sectionSubjects.map((subject, index) => supabase.from("subjects").update({section_id: sectionId, sort_order: index}).eq("id", subject.id).eq("account_username", accountUsername));
    if (moving.sectionId && moving.sectionId !== sectionId) {
      const oldSectionSubjects = nextSubjects.filter(subject => subject.sectionId === moving.sectionId).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
      updates.push(...oldSectionSubjects.map((subject, index) => supabase.from("subjects").update({sort_order: index}).eq("id", subject.id).eq("account_username", accountUsername)));
    }
    const results = await Promise.all(updates);
    const error = results.find(result => result.error)?.error;
    if (error) return setDataError(error.message);
    const oldSectionSubjects = moving.sectionId ? nextSubjects.filter(subject => subject.sectionId === moving.sectionId).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)) : [];
    setSubjects(nextSubjects.map(subject => {
      const updated = sectionSubjects.find(item => item.id === subject.id);
      const oldIndex = oldSectionSubjects.findIndex(item => item.id === subject.id);
      return updated ? {...subject, sectionId, sortOrder: sectionSubjects.indexOf(updated)} : moving.sectionId !== sectionId && oldIndex >= 0 ? {...subject, sortOrder: oldIndex} : subject;
    }).concat({...moving, sectionId, sortOrder: sectionSubjects.findIndex(subject => subject.id === moving.id)}));
  };
  const saveItem = async form => {
    const selectedFiles = [...(document.querySelector('input[type="file"]')?.files || [])];
    const uploadedFiles = await Promise.all(selectedFiles.map(file => new Promise((resolve, reject) => {const reader = new FileReader(); reader.onload = () => resolve({name: file.name, size: file.size, type: file.type, dataUrl: reader.result}); reader.onerror = reject; reader.readAsDataURL(file);}))); 
    const existingFiles = (form.files || []).filter(file => !selectedFiles.some(selectedFile => selectedFile.name === file.name));
    const payload = {account_username: accountUsername, subject_id: form.subjectId, category: form.category, title: form.title.trim(), description: form.description.trim() || null, deadline: form.deadline, priority: form.priority, status: form.status || "Pending", submitted_at: form.submittedAt || null, files: [...existingFiles, ...uploadedFiles]};
    const result = form.id ? await supabase.from("requirements").update(payload).eq("id", form.id).eq("account_username", accountUsername).select().single() : await supabase.from("requirements").insert(payload).select().single();
    if (result.error) throw new Error(result.error.message);
    const item = mapItem(result.data);
    setItems(current => form.id ? current.map(existing => existing.id === form.id ? item : existing) : [...current, item]);
  };

  if (!authenticated) return <Login onLogin={username => {localStorage.setItem("studyflow-account", username); setAccountUsername(username); setAuthenticated(true);}}/>;

  return <div className={`app ${mobileNavOpen ? "navOpen" : ""}`}>
    <button className="mobileMenu" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation"><Menu size={21}/></button>
    <button className="navBackdrop" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation"/>
    <aside className="sidebar">
      <div className="mobileSidebarHead"><span>Workspace</span><button onClick={() => setMobileNavOpen(false)} aria-label="Close navigation"><X size={20}/></button></div>
      <div className="brand"><div className="brandIcon"><img src="/sjit-logo.png" alt="Saint Joseph Institute of Technology logo"/></div><div><b>Saint Joseph Institute of Technology - ETEEAP 2026-2027</b><span>Academic Manager</span></div></div>
      <button className={`nav ${selected === "dashboard" ? "active" : ""}`} onClick={() => {setSelected("dashboard"); setMobileNavOpen(false);}}><LayoutDashboard size={18}/>Dashboard</button>
      <div className="sideTitle">SUBJECTS</div>
      <SubjectSections sections={sections} subjects={subjects} selected={selected} onSelect={id => {setSelected(id); setMobileNavOpen(false);}} onRename={renameSection} onMove={moveSubject} onEdit={subject => {setModal({type: "subject", subject}); setMobileNavOpen(false);}}/>
      <button className="addSubject" onClick={() => {setModal({type: "subject"}); setMobileNavOpen(false);}}><Plus size={17}/> Add Subject</button>
      <div className="sidebarBottom"><div className="tip"><Clock3 size={17}/><div><b>Stay ahead</b><p>Complete tasks before they turn red.</p></div></div><button className="logout" onClick={() => {localStorage.removeItem("studyflow-account"); setAccountUsername(""); setAuthenticated(false); setMobileNavOpen(false);}}><LogOut size={16}/>Log out</button></div>
    </aside>
    <main>
      <header><div><h1>{selected === "dashboard" ? "Dashboard" : subjects.find(subject => subject.id === selected)?.name}</h1><p>{selected === "dashboard" ? "Keep track of every module, task and activity in one place." : "Manage your requirements and deadlines for this subject."}</p></div><button className="primary" onClick={() => setModal({type: "item", subjectId: selected === "dashboard" ? subjects[0]?.id : selected})}><Plus size={18}/> Add Requirement</button></header>
      {dataError && <div className="dataError" role="alert">{dataError}</div>}
      {loading && <div className="loadingBar">Syncing your workspace...</div>}
      {selected === "dashboard" && <><section className="stats"><Stat icon={<BookOpen/>} label="Subjects" value={stats.subjects}/><Stat icon={<FileText/>} label="Requirements" value={stats.total}/><Stat icon={<Clock3/>} label="Pending" value={stats.pending}/><Stat icon={<CheckCircle2/>} label="Submitted" value={stats.submitted}/><Stat icon={<CircleAlert/>} label="Overdue" value={stats.overdue}/></section><section className="dashboardGrid"><div className="panel"><div className="panelHead"><div><h2>Upcoming deadlines</h2><span>Your next requirements</span></div><CalendarDays size={20}/></div><div className="list">{[...allItems].filter(item => item.status === "Pending").sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, 6).map(item => <ItemRow key={item.id} x={item} onSubmit={submit} onDelete={remove} onEdit={() => setModal({type: "item", item})}/>)}</div>{allItems.filter(item => item.status === "Pending").length === 0 && <Empty text="Everything is submitted. Great work!"/>}</div><div className="panel"><div className="panelHead"><div><h2>Subjects</h2><span>Quick overview</span></div></div>{subjects.map(subject => <SubjectCard key={subject.id} subject={subject} items={items} onSelect={setSelected}/>)}</div></section></>}
      {selected !== "dashboard" && <SubjectView items={filtered} onSubmit={submit} onDelete={remove} onEdit={item => setModal({type: "item", item})}/>} 
      {selected === "dashboard" && <section className="panel all"><div className="panelHead"><div><h2>All requirements</h2><span>Search and manage everything</span></div><div className="search"><Search size={17}/><input placeholder="Search..." value={query} onChange={event => setQuery(event.target.value)}/></div></div><div className="table">{filtered.map(item => <ItemRow key={item.id} x={item} showSubject onSubmit={submit} onDelete={remove} onEdit={() => setModal({type: "item", item})}/>)}</div></section>}
    </main>
    {modal && (modal.type === "subject" ? <SubjectModal subject={modal.subject} onSave={saveSubject} close={() => setModal(null)}/> : <Modal data={modal} subjects={subjects} onSaveSubject={saveSubject} onSaveItem={saveItem} close={() => setModal(null)}/>)}
    {previewFile && <FilePreviewModal file={previewFile} close={() => {URL.revokeObjectURL(previewFile.previewUrl); setPreviewFile(null);}}/>}
  </div>;
}

function Login({onLogin}) { const [username, setUsername] = useState(""); const [password, setPassword] = useState(""); const [showPassword, setShowPassword] = useState(false); const [error, setError] = useState(""); const submit = event => {event.preventDefault(); if (username === import.meta.env.VITE_APP_USERNAME && password === import.meta.env.VITE_APP_PASSWORD) onLogin(); else setError("That username or password is not correct.");}; return <div className="loginPage"><div className="loginArtwork"><div className="artTop"><span className="artMark"><BookOpen size={20}/></span><span>Saint Joseph Institute of Technology - ETEEAP</span></div><div className="artCopy"><p className="eyebrow">ACADEMIC ACTIVITY MANAGER</p><h1>Make every deadline feel manageable.</h1><p>One calm place for your subjects, activities, and progress.</p></div><div className="artNote"><CheckCircle2 size={18}/><span>Keep your momentum visible.</span></div></div><main className="loginMain"><div className="loginCard"><div className="loginIcon"><LockKeyhole size={21}/></div><p className="eyebrow">WELCOME BACK</p><h2>Sign in to CC's Study Load</h2><p className="loginIntro">Pick up where you left off.</p><form onSubmit={submit}><label>Username<input autoComplete="username" value={username} onChange={event => {setUsername(event.target.value); setError("");}} placeholder="Enter your username" autoFocus/></label><label>Password<div className="passwordField"><input type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={event => {setPassword(event.target.value); setError("");}} placeholder="Enter your password"/><button type="button" className="passwordToggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label>{error && <p className="loginError" role="alert">{error}</p>}<button className="loginSubmit" type="submit">Sign in <ArrowRight size={18}/></button></form><p className="loginFoot">Your workspace is ready when you are.</p></div></main></div>; }
function LoginWithAccounts({onLogin}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const submit = event => {
    event.preventDefault();
    const credentials = [[import.meta.env.VITE_APP_USERNAME, import.meta.env.VITE_APP_PASSWORD], [import.meta.env.VITE_APP_USERNAME_2, import.meta.env.VITE_APP_PASSWORD_2]];
    if (credentials.some(([validUsername, validPassword]) => username === validUsername && password === validPassword)) onLogin(username);
    else setError("That username or password is not correct.");
  };
  return <div className="loginPage">
    <section className="loginArtwork">
      <div className="loginBrand"><img src="/sjit-logo.png" alt="Saint Joseph Institute of Technology logo"/><div><b>Saint Joseph Institute of Technology - ETEEAP</b><span>ACADEMIC ACTIVITY MANAGER</span></div></div>
      <div className="loginMessage"><h1>Small steps today,<br/><em>big dreams tomorrow.</em></h1><p>Stay organized. Submit on time.<br/>Complete your homework and performance tasks.<br/>You've got this!</p></div>
      <div className="loginFeatures"><span><CalendarDays size={25}/><b>Track<br/>Deadlines</b></span><span><FileText size={25}/><b>Manage<br/>Activities</b></span><span><Clock3 size={25}/><b>Be<br/>On Time</b></span><span><CheckCircle2 size={25}/><b>Achieve<br/>Your Goals</b></span></div>
      <div className="loginFooterQuote">Future Success<br/>Starts with<br/>Your Effort</div>
    </section>
    <main className="loginMain"><div className="loginCard">
      <div className="loginMotto">Your Tasks<br/><em>Matter!</em></div>
      <p className="eyebrow">WELCOME BACK</p><h2>Sign in to Your<br/>Student Account</h2><p className="loginIntro">Access your subjects, activities, and performance<br className="desktopOnly"/> tasks all in one place.</p>
      <form onSubmit={submit}><label>Username<div className="loginInput"><BookOpen size={18}/><input autoComplete="username" value={username} onChange={event => {setUsername(event.target.value); setError("");}} placeholder="Enter your username" autoFocus/></div></label><label>Password<div className="loginInput"><LockKeyhole size={18}/><input type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={event => {setPassword(event.target.value); setError("");}} placeholder="Enter your password"/><button type="button" className="passwordToggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>{error && <p className="loginError" role="alert">{error}</p>}<button className="loginSubmit" type="submit">Sign In <ArrowRight size={20}/></button></form>
      <p className="loginHelp"><BookOpen size={16}/> Do you want to have your own? Contact Christian Cervantes.</p><div className="loginTip"><CheckCircle2 size={21}/><span>Keep going, you're closer<br/>to your goals than you think.</span></div>
    </div></main>
  </div>;
}

function FilePreviewModal({file, close}) {
  const officeRef = useRef(null);
  const extension = file.name?.split(".").pop()?.toLowerCase();
  const isDocx = extension === "docx" || extension === "docs";
  const isPptx = false;
  const isImage = file.type?.startsWith("image/");
  const canEmbed = file.type?.startsWith("image/") || file.type === "application/pdf" || file.type?.startsWith("text/");
  useEffect(() => {
    if (!officeRef.current || (!isDocx && !isPptx)) return;
    officeRef.current.innerHTML = "";
    const [header, encoded] = file.dataUrl.split(",");
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    const blob = new Blob([bytes], {type: file.type || header.match(/data:(.*?);/)?.[1] || "application/octet-stream"});
    const render = renderDocx(blob, officeRef.current, officeRef.current, {breakPages: true, useBase64URL: true});
    Promise.resolve(render).catch(() => {if (officeRef.current) officeRef.current.innerHTML = "<p class=\"officePreviewError\">This Office file could not be rendered. Please download it instead.</p>";});
  }, [file, isDocx, isPptx]);
  return <div className="overlay filePreviewOverlay" onClick={close}><div className="filePreviewModal" onClick={event => event.stopPropagation()}><div className="modalHead"><div><h2>Preview file</h2><span>{file.name}</span></div><button onClick={close} aria-label="Close preview"><X/></button></div>{isImage ? <div className="imagePreview"><img src={file.previewUrl} alt={file.name}/></div> : canEmbed ? <iframe title={`Preview ${file.name}`} src={file.previewUrl}/> : isDocx || isPptx ? <div ref={officeRef} className="officePreview"/> : <div className="filePreviewFallback"><FileText size={42}/><b>{file.name}</b><p>This file type cannot be displayed in the browser, but you can download it.</p><a href={file.dataUrl} download={file.name}><Download size={17}/> Download file</a></div>}</div></div>;
}

function SubjectSections({sections, subjects, selected, onSelect, onRename, onMove, onEdit}) {
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState("");
  const beginRename = section => {setEditing(section.id); setDraft(section.name);};
  const finishRename = section => {onRename(section, draft); setEditing(null);};
  const visibleSections = [...sections, ...(subjects.some(subject => !sections.some(section => section.id === subject.sectionId)) ? [{id: "__ungrouped__", sectionId: null, name: "My Subjects"}] : [])];
  return <div className="subjectSections">{visibleSections.map(section => {
    const targetSectionId = section.id === "__ungrouped__" ? null : section.id;
    const sectionSubjects = subjects.filter(subject => subject.sectionId === targetSectionId || (section.id === "__ungrouped__" && !sections.some(existingSection => existingSection.id === subject.sectionId))).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    return <div className="subjectSection" key={section.id} onDragOver={event => event.preventDefault()} onDrop={event => {event.preventDefault(); const subjectId = event.dataTransfer.getData("subject-id"); if (subjectId) onMove(subjectId, targetSectionId);}}>
          <div className="sectionHeading">{editing === section.id ? <input value={draft} autoFocus onChange={event => setDraft(event.target.value)} onBlur={() => finishRename(section)} onKeyDown={event => {if (event.key === "Enter") finishRename(section); if (event.key === "Escape") setEditing(null);}}/> : <span>{section.name}</span>}{section.id !== "__ungrouped__" && <button className="sectionEdit" onClick={() => beginRename(section)} aria-label={`Rename ${section.name}`}><Pencil size={11}/></button>}</div>
      {sectionSubjects.map(subject => <div className="subjectRow" key={subject.id}><button draggable className={`nav subjectNav ${selected === subject.id ? "active" : ""}`} onDragStart={event => event.dataTransfer.setData("subject-id", subject.id)} onDragOver={event => event.preventDefault()} onDrop={event => {event.preventDefault(); event.stopPropagation(); const subjectId = event.dataTransfer.getData("subject-id"); if (subjectId && subjectId !== subject.id) onMove(subjectId, section.id, subject.id);}} onClick={() => onSelect(subject.id)}><GripVertical className="dragHandle" size={13}/><span className="dot" style={{background: subject.color}}/><span className="subjectLabel"><span>{subject.name}</span>{subject.instructor && <small>{subject.instructor}</small>}</span></button><button className="subjectEdit" onClick={() => onEdit(subject)} aria-label={`Edit ${subject.name}`}><Pencil size={12}/></button></div>)}
      {!sectionSubjects.length && <div className="dropHint">Drop subjects here</div>}
    </div>;
  })}</div>;
}
function Stat({icon, label, value}) { return <div className="stat"><span>{icon}</span><div><b>{value}</b><small>{label}</small></div></div>; }
function SubjectCard({subject, items, onSelect}) { const count = items.filter(item => item.subjectId === subject.id).length; const submitted = items.filter(item => item.subjectId === subject.id && item.status === "Submitted").length; return <div className="subjectCard" onClick={() => onSelect(subject.id)}><span className="subjectIcon" style={{background: subject.color}}><BookOpen size={19}/></span><div className="grow"><b>{subject.name}</b><small>{subject.code || "No code"} · {subject.instructor || "No instructor"} · {count} requirements</small><div className="bar"><i style={{width: count ? `${submitted / count * 100}%` : "0%", background: subject.color}}/></div></div><span className="percent">{count ? Math.round(submitted / count * 100) : 0}%</span><ChevronRight size={17}/></div>; }
function SubjectView({items, onSubmit, onDelete, onEdit}) { const [filter, setFilter] = useState("All"); const shown = items.filter(item => filter === "All" || item.category === filter || item.status === filter).sort((a, b) => a.deadline.localeCompare(b.deadline)); return <section className="panel subjectPanel"><div className="filters">{["All", "Module", "Task", "Activity", "Others", "Pending", "Submitted"].map(value => <button className={filter === value ? "sel" : ""} onClick={() => setFilter(value)} key={value}>{value}</button>)}</div><div className="list">{shown.map(item => <ItemRow key={item.id} x={item} onSubmit={onSubmit} onDelete={onDelete} onEdit={() => onEdit(item)}/>)}</div>{!shown.length && <Empty text="No requirements found."/>}</section>; }
function ItemRow({x, onSubmit, onDelete, onEdit, showSubject}) { const remaining = daysLeft(x.deadline); const tone = x.status === "Submitted" ? "submitted" : remaining < 0 ? "overdue" : remaining <= 1 ? "red" : remaining <= 3 ? "orange" : remaining <= 7 ? "yellow" : "green"; const openFile = file => {if (file.dataUrl) window.open(file.dataUrl, "_blank", "noopener,noreferrer");}; const downloadFile = file => {if (!file.dataUrl) return; const link = document.createElement("a"); link.href = file.dataUrl; link.download = file.name || "attachment"; document.body.appendChild(link); link.click(); link.remove();}; return <div className="item"><div className={`deadline ${tone}`}><b>{x.status === "Submitted" ? "✓" : remaining < 0 ? "!" : Math.max(remaining, 0)}</b><small>{x.status === "Submitted" ? "DONE" : remaining < 0 ? "LATE" : remaining === 0 ? "TODAY" : remaining === 1 ? "DAY" : "DAYS"}</small></div><div className="itemMain"><div className="itemTop"><span className="tag">{x.category}</span>{showSubject && <span className="subjectName">{x.subject}</span>}<span className={`priority ${x.priority.toLowerCase()}`}>{x.priority}</span></div><h3>{x.title}</h3><p>{x.description || "No description."}</p><div className="meta">Deadline: <b>{formatDate(x.deadline)}</b>{x.status === "Pending" && <span className="remainingText"> · {deadlineLabel(remaining)}</span>}{x.status === "Submitted" && <> · Submitted {formatDateTime(x.submittedAt)}</>}{x.files?.length > 0 && <> · 📎 {x.files.length} file(s)</>}</div>{x.files?.length > 0 && <div className="attachments">{x.files.map((file, index) => <div className="attachment" key={`${file.name}-${index}`}><FileText size={14}/><span title={file.name}>{file.name}</span><button type="button" onClick={() => openFile(file)} disabled={!file.dataUrl} aria-label={`View ${file.name}`} title={file.dataUrl ? "View file" : "Edit this requirement and re-select the file to enable viewing"}><Eye size={14}/></button><button type="button" onClick={() => downloadFile(file)} disabled={!file.dataUrl} aria-label={`Download ${file.name}`} title={file.dataUrl ? "Download file" : "Edit this requirement and re-select the file to enable downloading"}><Download size={14}/></button></div>)}</div>}</div><div className="actions">{x.status === "Pending" ? <button className="statusButton pending" onClick={() => onSubmit(x.id)}><CheckCircle2 size={16}/> Pending</button> : <span className="statusButton submitted"><CheckCircle2 size={16}/> Submitted</span>}<button className="iconBtn" onClick={onEdit}><Pencil size={16}/></button><button className="iconBtn danger" onClick={() => onDelete(x.id)}><Trash2 size={16}/></button></div></div>; }
function Empty({text}) { return <div className="empty"><FolderOpen size={30}/><b>{text}</b></div>; }
function SubjectModal({subject, onSave, close}) { const [form, setForm] = useState({...(subject || {}), name: subject?.name || "", code: subject?.code || "", color: subject?.color || "#2563eb", instructor: subject?.instructor || ""}); const [error, setError] = useState(""); const [saving, setSaving] = useState(false); const save = async () => {if (!form.name.trim()) return setError("Subject name is required."); setSaving(true); setError(""); try {await onSave(form); close();} catch (saveError) {setError(saveError.message);} finally {setSaving(false);}}; return <div className="overlay"><div className="modal"><div className="modalHead"><h2>{subject ? "Edit Subject" : "Add Subject"}</h2><button onClick={close}><X/></button></div><label>Subject name<input value={form.name} onChange={event => setForm({...form, name: event.target.value})}/></label><label>Subject code<input value={form.code} onChange={event => setForm({...form, code: event.target.value})}/></label><label>Instructor<input value={form.instructor} onChange={event => setForm({...form, instructor: event.target.value})} placeholder="Name of instructor"/></label><label>Color<input type="color" value={form.color} onChange={event => setForm({...form, color: event.target.value})}/></label>{error && <p className="loginError" role="alert">{error}</p>}<div className="modalActions"><button onClick={close}>Cancel</button><button className="primary" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</button></div></div></div>; }
function Modal({data, subjects, onSaveSubject, onSaveItem, close}) { const isSubject = data.type === "subject"; const old = data.item; const [form, setForm] = useState(old ? {...old, files: old.files || []} : isSubject ? {name: "", code: "", color: "#2563eb"} : {subjectId: data.subjectId || subjects[0]?.id, category: "Task", title: "", description: "", deadline: "", priority: "Medium", status: "Pending", files: []}); const [error, setError] = useState(""); const [saving, setSaving] = useState(false); const save = async () => {if (isSubject && !form.name.trim()) return; if (!isSubject && (!form.title.trim() || !form.deadline)) return; setSaving(true); setError(""); try {if (isSubject) await onSaveSubject(form); else await onSaveItem(form); close();} catch (saveError) {setError(saveError.message);} finally {setSaving(false);}}; const fileChange = event => {const files = [...event.target.files].map(file => ({name: file.name, size: file.size, type: file.type})); setForm({...form, files: [...(form.files || []), ...files]});}; return <div className="overlay"><div className="modal"><div className="modalHead"><h2>{isSubject ? "Add Subject" : old ? "Edit Requirement" : "Add Requirement"}</h2><button onClick={close}><X/></button></div>{isSubject ? <><label>Subject name<input value={form.name} onChange={event => setForm({...form, name: event.target.value})}/></label><label>Subject code<input value={form.code} onChange={event => setForm({...form, code: event.target.value})}/></label><label>Color<input type="color" value={form.color} onChange={event => setForm({...form, color: event.target.value})}/></label></> : <><label>Subject<select value={form.subjectId} onChange={event => setForm({...form, subjectId: event.target.value})}>{subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label><label>Category<select value={form.category} onChange={event => setForm({...form, category: event.target.value})}>{["Module", "Task", "Activity", "Others"].map(category => <option key={category}>{category}</option>)}</select></label><label>Title<input value={form.title} onChange={event => setForm({...form, title: event.target.value})}/></label><label>Description<textarea value={form.description} onChange={event => setForm({...form, description: event.target.value})}/></label><div className="two"><label>Deadline<input type="date" value={form.deadline} onChange={event => setForm({...form, deadline: event.target.value})}/></label><label>Priority<select value={form.priority} onChange={event => setForm({...form, priority: event.target.value})}>{["Low", "Medium", "High"].map(priority => <option key={priority}>{priority}</option>)}</select></label></div><label className="upload"><Upload size={18}/> Attach files<input type="file" multiple onChange={fileChange}/></label>{form.files?.length > 0 && <div className="fileList">{form.files.map((file, index) => <span key={index}>📎 {file.name}</span>)}</div>}</>} {error && <p className="loginError" role="alert">{error}</p>}<div className="modalActions"><button onClick={close}>Cancel</button><button className="primary" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</button></div></div></div>; }
function daysLeft(date) { if (!date) return 999; const today = new Date(); today.setHours(0, 0, 0, 0); return Math.ceil((new Date(`${date}T00:00:00`) - today) / 86400000); }
function deadlineLabel(remaining) { if (remaining < 0) return `${Math.abs(remaining)} ${Math.abs(remaining) === 1 ? "day" : "days"} overdue`; if (remaining === 0) return "Due today"; return `${remaining} ${remaining === 1 ? "day" : "days"} left`; }
function formatDate(date) { if (!date) return "—"; return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {month: "short", day: "numeric", year: "numeric"}); }
function formatDateTime(date) { return date ? new Date(date).toLocaleDateString(undefined, {month: "short", day: "numeric"}) : ""; }

createRoot(document.getElementById("root")).render(<App/>);
