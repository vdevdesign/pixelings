import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

interface Student {
  id: string;
  username: string;
  approved_nickname: string;
}

interface QuickNeed {
  id: string;
  label: string;
  emoji: string;
  message: string;
}

export const TeacherDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'roster' | 'communication'>('roster');
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [studentSlots, setStudentSlots] = useState([{ name: '', code: '' }]);
  const [revealedCodes, setRevealedCodes] = useState<Record<string, string>>({});
  const [quickNeeds, setQuickNeeds] = useState<QuickNeed[]>([]);
  const [pendingDelete, setPendingDelete] = useState<Student | null>(null);

  const fetchStudents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, approved_nickname')
      .eq('role', 'computer')
      .order('username');
    if (error) setError(error.message);
    else setStudents(data || []);
    setLoading(false);
  };

  useEffect(() => { 
    fetchStudents(); 
    // Initialize some default quick needs
    setQuickNeeds([
      { id: 'needs-bathroom', label: 'Bathroom', emoji: '🚽', message: 'I need to use the restroom' },
      { id: 'needs-water', label: 'Water/Snack', emoji: '🍎', message: 'I am hungry or thirsty' },
      { id: 'needs-help', label: 'Help', emoji: '🆘', message: 'I need help' },
      { id: 'needs-break', label: 'Break', emoji: '🎧', message: 'I need a sensory break' },
    ]);
  }, []);

  const updateSlot = (index: number, field: 'name' | 'code', value: string) => {
    setStudentSlots((slots) => slots.map((slot, i) => (i === index ? { ...slot, [field]: value } : slot)));
  };

  const addSlot = () => setStudentSlots((slots) => [...slots, { name: '', code: '' }]);
  const removeSlot = () => setStudentSlots((slots) => (slots.length > 1 ? slots.slice(0, -1) : slots));

  const generateCodes = () => {
    setStudentSlots((slots) => slots.map((slot) => (
      slot.code ? slot : { ...slot, code: Math.floor(100000 + Math.random() * 900000).toString() }
    )));
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const valid = studentSlots.filter((slot) => slot.name && slot.code);
    if (valid.length === 0) return;

    setError('');
    const failures: string[] = [];
    for (const slot of valid) {
      const { error } = await supabase.rpc('create_student_profile', {
        first_name: slot.name,
        access_code: slot.code
      });
      if (error) failures.push(`${slot.name}: ${error.message}`);
    }

    if (failures.length > 0) {
      setError(`Some students could not be added — ${failures.join(' | ')}`);
    } else {
      setError('');
      setStudentSlots([{ name: '', code: '' }]);
    }
    fetchStudents();
  };

  const handleDeleteStudent = async (id: string) => {
    const student = pendingDelete;
    setPendingDelete(null);
    if (!student) return;

    setError('');
    const { error } = await supabase.rpc('delete_student', { student_id: id });
    if (error) setError(`Error deleting student: ${error.message}`);
    fetchStudents();
  };

  const handleShowCode = async (id: string) => {
    const { data, error: rpcError } = await supabase.rpc('get_student_code', { student_id: id });
    if (rpcError) setError(rpcError.message);
    else setRevealedCodes((prev) => ({ ...prev, [id]: (data as string | null) || 'No revealable code — reset the code once to store one.' }));
  };

  const toggleAllCodes = async () => {
    if (allRevealed) {
      setRevealedCodes({});
      return;
    }
    setError('');
    const results = await Promise.all(students.map(async (s) => {
      const { data, error: rpcError } = await supabase.rpc('get_student_code', { student_id: s.id });
      if (rpcError) return [s.id, `Error`] as const;
      return [s.id, (data as string | null) || 'No revealable code — reset the code once to store one.'] as const;
    }));
    setRevealedCodes(Object.fromEntries(results));
  };

  const allRevealed = students.length > 0 && students.every((s) => revealedCodes[s.id]);

  const handleResetCode = async (id: string) => {
    const newCode = prompt('Enter new magic access code:');
    if (!newCode) return;

    const { error } = await supabase.rpc('reset_student_code', {
      student_id: id,
      new_code: newCode
    });

    if (error) alert(`Error: ${error.message}`);
    else alert('Access code updated successfully!');
  };

  const handleRegenerateCode = async (id: string) => {
    const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
    const confirmRegen = confirm(`Generate a new random code for this student?`);
    if (!confirmRegen) return;

    const { error } = await supabase.rpc('reset_student_code', {
      student_id: id,
      new_code: randomCode
    });

    if (error) alert(`Error: ${error.message}`);
    else alert(`New magic code generated: ${randomCode}\n\nPlease save this code for the student!`);
  };

  const handleAddQuickNeed = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const newNeed = {
      id: `need-${Date.now()}`,
      label: formData.get('label') as string,
      emoji: formData.get('emoji') as string,
      message: formData.get('message') as string,
    };
    setQuickNeeds([...quickNeeds, newNeed]);
    form.reset();
  };

  const deleteQuickNeed = (id: string) => {
    setQuickNeeds(quickNeeds.filter(n => n.id !== id));
  };

  return (
    <div className="teacher-dashboard">
      <nav className="dashboard-nav">
        <button 
          className={activeTab === 'roster' ? 'active' : ''} 
          onClick={() => setActiveTab('roster')}
        >
          🎓 Student Roster
        </button>
        <button 
          className={activeTab === 'communication' ? 'active' : ''} 
          onClick={() => setActiveTab('communication')}
        >
          💬 Communication Tools
        </button>
      </nav>

      <main className="dashboard-content">
        {activeTab === 'roster' ? (
          <div className="tab-panel">
            <section className="manager-card">
              <h2 className="card-title">Add New Students</h2>
              <p className="subtitle">Add one student, or use the + / − buttons to add several at once.</p>
              <form onSubmit={handleAddStudent} className="student-form">
                {studentSlots.map((slot, index) => (
                  <div key={index} className="student-form-main">
                    <div className="input-group">
                      <label>First Name {studentSlots.length > 1 ? `#${index + 1}` : ''}</label>
                      <input
                        value={slot.name}
                        onChange={(e) => updateSlot(index, 'name', e.target.value)}
                        placeholder="e.g. Maya"
                      />
                    </div>
                    <div className="input-group">
                      <label>Magic Code</label>
                      <input
                        value={slot.code}
                        onChange={(e) => updateSlot(index, 'code', e.target.value)}
                        placeholder="e.g. 123456"
                      />
                    </div>
                  </div>
                ))}
                <div className="slot-controls">
                  <button type="button" className="slot-btn" onClick={addSlot} aria-label="Add another student" title="Add another student">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                  <button type="button" className="slot-btn" onClick={removeSlot} disabled={studentSlots.length <= 1} aria-label="Remove a student slot" title="Remove a student slot">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                </div>
                <div className="student-form-footer">
                  <button type="button" className="generate-code-btn" onClick={generateCodes}>
                    🎲 Generate Random Codes for All
                  </button>
                  <button type="submit" className="submit-btn">
                    Add {studentSlots.filter((slot) => slot.name && slot.code).length || ''} Student{studentSlots.length > 1 ? 's' : ''}
                  </button>
                </div>
              </form>
              {error && <div className="manager-error">{error}</div>}
            </section>

            <section className="student-list-card">
              <div className="roster-header">
                <h2 className="card-title">Class Roster</h2>
                <button onClick={() => void toggleAllCodes()} className="action-btn toggle-all-btn" disabled={loading || students.length === 0}>
                  {allRevealed ? '🙈 Hide All Codes' : '👁 Show All Codes'}
                </button>
              </div>
              {loading ? <p>Loading students...</p> : (
                <table className="student-table">
                  <thead className="table-head">
                    <tr>
                      <th>Name</th>
                      <th>Nickname</th>
                      <th>Code</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map(s => (
                      <tr key={s.id}>
                        <td>{s.username}</td>
                        <td>{s.approved_nickname || '-'}</td>
                        <td><span className="code-pill">{revealedCodes[s.id] || '••••••'}</span></td>
                        <td className="action-cell">
                          {revealedCodes[s.id]
                            ? <button onClick={() => setRevealedCodes((prev) => { const next = { ...prev }; delete next[s.id]; return next; })} className="action-btn">Hide</button>
                            : <button onClick={() => void handleShowCode(s.id)} className="action-btn">Show</button>}
                          <button onClick={() => handleResetCode(s.id)} className="action-btn">Reset</button>
                          <button onClick={() => handleRegenerateCode(s.id)} className="action-btn regen-btn">🎲 Regenerate</button>
                          <button
                            onClick={() => setPendingDelete(s)}
                            className="icon-btn delete-student-btn"
                            aria-label={`Delete ${s.username}`}
                            title={`Delete ${s.username}`}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>
        ) : (
          <div className="tab-panel">
            <section className="manager-card">
              <h2 className="card-title">Quick-Need Buttons</h2>
              <p className="subtitle">Create visual shortcuts for students to signal their needs instantly.</p>
              
              <form onSubmit={handleAddQuickNeed} className="quick-need-form">
                <div className="input-group">
                  <label>Emoji</label>
                  <input name="emoji" placeholder="🍎" maxLength={2} required />
                </div>
                <div className="input-group">
                  <label>Label</label>
                  <input name="label" placeholder="Snack" required />
                </div>
                <div className="input-group">
                  <label>Message to send</label>
                  <input name="message" placeholder="I need a snack" required />
                </div>
                <button type="submit" className="submit-btn">Add Button</button>
              </form>

              <div className="quick-needs-grid">
                {quickNeeds.map(n => (
                  <div key={n.id} className="need-item">
                    <span className="need-emoji">{n.emoji}</span>
                    <div className="need-info">
                      <strong className="need-label">{n.label}</strong>
                      <span className="need-msg">{n.message}</span>
                    </div>
                    <button onClick={() => deleteQuickNeed(n.id)} className="delete-btn">×</button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>

      {pendingDelete && (
        <div className="confirm-overlay" role="dialog" aria-modal="true" onClick={() => setPendingDelete(null)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Delete student?</h3>
            <p>
              This will permanently remove <strong>{pendingDelete.username}</strong> along with their wallet and inventory. This cannot be undone.
            </p>
            <div className="confirm-actions">
              <button className="confirm-cancel" onClick={() => setPendingDelete(null)}>Cancel</button>
              <button className="confirm-danger" onClick={() => void handleDeleteStudent(pendingDelete.id)}>Delete student</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .slot-controls {
          display: flex;
          justify-content: center;
          gap: 0.75rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid #f0f0f0;
        }
        .slot-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          border: 1px solid #1c5262;
          background: #0c1c27;
          color: #d3d1c7;
          cursor: pointer;
          transition: all 0.2s;
        }
        .slot-btn:hover:not(:disabled) { background: #123c46; border-color: #00f5ff; }
        .slot-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .student-form-footer {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 1rem;
        }
        .icon-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.45rem;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 6px;
          color: #b91c1c;
          cursor: pointer;
          transition: all 0.2s;
        }
        .icon-btn:hover { background: #fee2e2; }
        .confirm-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .confirm-dialog {
          background: #0c1c27f5;
          border: 1px solid #1c5262;
          border-radius: 16px;
          padding: 1.75rem 2rem;
          max-width: 420px;
          width: calc(100% - 2rem);
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45);
        }
        .confirm-dialog h3 { margin: 0 0 0.75rem; font-size: 1.2rem; color: #eaffff; }
        .confirm-dialog p { margin: 0 0 1.5rem; color: #9ab7bd; font-size: 0.95rem; line-height: 1.5; }
        .confirm-actions { display: flex; justify-content: flex-end; gap: 0.75rem; }
        .confirm-cancel {
          padding: 0.55rem 1.1rem;
          background: #102936;
          color: #d3d1c7;
          border: 1px solid #1c5262;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
        }
        .confirm-danger {
          padding: 0.55rem 1.1rem;
          background: #d32f2f;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
        }
        .confirm-danger:hover { background: #b71c1c; }
        .teacher-dashboard { 
          padding: 2rem; 
          max-width: 1100px; 
          margin: 0 auto; 
          font-family: inherit; 
          color: #d3d1c7; 
        }
        .teacher-dashboard h1, .teacher-dashboard h2, .teacher-dashboard h3, .teacher-dashboard strong { color: #eaffff; }
        .teacher-dashboard p, .teacher-dashboard .subtitle, .teacher-dashboard .input-group label { color: #9ab7bd; }
        .dashboard-nav { 
          display: flex; 
          gap: 1rem; 
          margin-bottom: 2rem; 
          border-bottom: 2px solid #1c5262; 
          padding-bottom: 1rem; 
        }
        .dashboard-nav button { 
          padding: 0.8rem 1.5rem; 
          border: none; 
          background: transparent; 
          cursor: pointer; 
          font-size: 1rem; 
          font-weight: 600; 
          color: #9ab7bd; 
          border-radius: 8px; 
          transition: all 0.2s;
        }
        .dashboard-nav button.active { 
          background: #4CAF50; 
          color: white; 
          box-shadow: 0 4px 10px rgba(76, 175, 80, 0.3); 
        }
        .tab-panel { animation: fadeIn 0.3s ease-in; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        
        .manager-card, .student-list-card { 
          background: #0c1c27d9; 
          backdrop-filter: blur(10px);
          padding: 2rem; 
          border-radius: 16px; 
          box-shadow: 0 4px 20px rgba(0,0,0,0.35); 
          margin-bottom: 2rem; 
          border: 1px solid #1c5262;
        }
        .card-title { 
          font-size: 1.4rem; 
          margin-bottom: 1.5rem; 
          color: #eaffff; 
          font-weight: 700;
          border-bottom: 2px solid #123c46;
          padding-bottom: 0.75rem;
        }
        .roster-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
        }
        .roster-header .card-title { flex: 1; }
        .toggle-all-btn {
          margin-top: 0.25rem;
          white-space: nowrap;
          font-weight: 500;
        }
        .toggle-all-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .subtitle { color: #666; margin-bottom: 1.5rem; font-size: 0.95rem; }
        .student-form, .quick-need-form { 
          display: flex; 
          flex-direction: column;
          gap: 1rem; 
        }
        .student-form-main {
          display: flex; 
          gap: 1.2rem; 
          align-items: flex-end; 
          flex-wrap: wrap;
        }
        .input-group {  
          display: flex; 
          flex-direction: column; 
          gap: 0.5rem; 
        }
        .input-group label { 
          font-size: 0.85rem; 
          font-weight: 600; 
          color: #555; 
        }
        .input-group input { 
          padding: 0.7rem; 
          border: 1px solid #1c5262; 
          border-radius: 8px; 
          min-width: 180px; 
          color: #eaffff; 
          background: #07141d;
          transition: border-color 0.2s;
        }
        .input-group input::placeholder { color: #5b7a86; }
        .input-group input:focus {
          outline: none;
          border-color: #00f5ff;
          box-shadow: 0 0 0 2px rgba(0, 245, 255, 0.2);
        }
        .generate-code-btn {
          padding: 0.5rem 1rem; 
          background: #0c1c27; 
          border: 1px solid #1c5262; 
          border-radius: 20px; 
          cursor: pointer; 
          font-size: 0.85rem; 
          color: #9ab7bd; 
          transition: all 0.2s;
          font-weight: 500;
        }
        .generate-code-btn:hover { 
          background: #123c46; 
          color: #eaffff; 
          border-color: #00f5ff;
        }
        .submit-btn { 
          padding: 0.7rem 1.5rem; 
          background: #4CAF50; 
          color: white; 
          border: none; 
          border-radius: 8px; 
          cursor: pointer; 
          font-weight: bold; 
          transition: background 0.2s; 
          height: 42px;
        }
        .submit-btn:hover { background: #43a047; }
        .student-table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-top: 1.5rem; 
        }
        .table-head th { 
          color: #888; 
          font-weight: 500; 
          font-size: 0.9rem; 
          padding: 1rem;
          text-align: left;
          border-bottom: 2px solid #eee;
        }
        .text-right { text-align: right !important; }
        .student-table td { 
          padding: 1rem; 
          border-bottom: 1px solid #123c46; 
          color: #d3d1c7;
          font-size: 0.95rem;
        }
        .code-pill {
          background: #07141d;
          padding: 2px 8px;
          border-radius: 4px;
          font-family: monospace;
          color: #9ab7bd;
          font-size: 0.85rem;
        }
        .action-cell { 
          text-align: right; 
          display: flex; 
          justify-content: flex-end; 
          gap: 0.5rem;
        }
        .action-btn { 
          padding: 0.5rem 1rem; 
          background: #0c1c27; 
          border: 1px solid #1c5262; 
          border-radius: 6px; 
          color: #d3d1c7;
          cursor: pointer; 
          font-size: 0.85rem; 
          transition: all 0.2s;
        }
        .action-btn:hover { background: #123c46; }
        .action-btn.regen-btn { 
          background: #123c46; 
          border-color: #ffe58f88; 
          color: #fff4b0;
          font-weight: 500;
        }
        .action-btn.regen-btn:hover { background: #1a4b55; }
        .table-head th { color: #5b7a86; }
        .manager-error { color: #d32f2f; margin-top: 1rem; font-size: 0.9rem; font-weight: 500; }
        .quick-needs-grid { 
          display: grid; 
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); 
          gap: 1rem; 
          margin-top: 1.5rem; 
        }
        .need-item { 
          display: flex; 
          align-items: center; 
          gap: 1rem; 
          padding: 1rem; 
          background: #0c1c27b3; 
          border: 1px solid #1c5262; 
          border-radius: 12px; 
          position: relative; 
          transition: transform 0.1s, box-shadow 0.2s;
        }
        .need-item:hover { 
          transform: scale(1.02); 
          background: #102936; 
          box-shadow: 0 2px 8px rgba(0,0,0,0.25); 
        }
        .need-emoji { 
          font-size: 1.8rem; 
          background: #07141d; 
          width: 50px; 
          height: 50px; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          border-radius: 10px; 
          box-shadow: 0 2px 4px rgba(0,0,0,0.3); 
        }
        .need-info { 
          display: flex; 
          flex-direction: column; 
          flex: 1; 
        }
        .need-label { 
          font-size: 1rem; 
          color: #eaffff; 
          font-weight: 600;
        }
        .need-msg { 
          font-size: 0.85rem; 
          color: #9ab7bd; 
        }
        .delete-btn { 
          background: transparent; 
          border: none; 
          color: #ccc; 
          font-size: 1.5rem; 
          cursor: pointer; 
          line-height: 1; 
          transition: color 0.2s;
        }
        .delete-btn:hover { color: #d32f2f; }
      `}</style>
    </div>
  );
};
