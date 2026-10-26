import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

interface Student {
  id: string;
  username: string;
  approved_nickname: string;
  access_code_hash: string;
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
  const [newStudent, setNewStudent] = useState({ name: '', code: '' });
  const [quickNeeds, setQuickNeeds] = useState<QuickNeed[]>([]);

  const fetchStudents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, approved_nickname, access_code_hash')
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

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.name || !newStudent.code) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('You must be logged in as a teacher to add students.');
      return;
    }

    const { error } = await supabase.rpc('create_student_profile', {
      classroom_user_id: user.id,
      first_name: newStudent.name,
      plain_access_code: newStudent.code
    });

    if (error) {
      setError(`Error adding student: ${error.message}`);
    } else {
      setError('');
      setNewStudent({ name: '', code: '' });
      fetchStudents();
    }
  };

  const handleResetCode = async (id: string) => {
    const newCode = prompt('Enter new magic access code:');
    if (!newCode) return;

    const { error } = await supabase.rpc('reset_student_code', {
      profile_id: id,
      new_plain_code: newCode
    });

    if (error) alert(`Error: ${error.message}`);
    else alert('Access code updated successfully!');
  };

  const handleRegenerateCode = async (id: string) => {
    const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
    const confirmRegen = confirm(`Generate a new random code for this student?`);
    if (!confirmRegen) return;

    const { error } = await supabase.rpc('reset_student_code', {
      profile_id: id,
      new_plain_code: randomCode
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
              <h2 className="card-title">Add New Student</h2>
              <form onSubmit={handleAddStudent} className="student-form">
                <div className="student-form-main">
                  <div className="input-group">
                    <label>First Name</label>
                    <input 
                      value={newStudent.name} 
                      onChange={e => setNewStudent({...newStudent, name: e.target.value})}
                      placeholder="e.g. Maya"
                    />
                  </div>
                  <div className="input-group">
                    <label>Magic Code</label>
                    <input 
                      value={newStudent.code} 
                      onChange={e => setNewStudent({...newStudent, code: e.target.value})}
                      placeholder="e.g. 123456"
                    />
                  </div>
                  <button type="submit" className="submit-btn">Add Student</button>
                </div>
                <div className="student-form-footer">
                  <button 
                    type="button" 
                    className="generate-code-btn" 
                    onClick={() => {
                      const code = Math.floor(100000 + Math.random() * 900000).toString();
                      setNewStudent(prev => ({ ...prev, code }));
                    }}
                  >
                    🎲 Generate Random Magic Code
                  </button>
                </div>
              </form>
              {error && <div className="manager-error">{error}</div>}
            </section>

            <section className="student-list-card">
              <h2 className="card-title">Class Roster</h2>
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
                        <td><span className="code-pill">••••••</span></td>
                        <td className="action-cell">
                          <button onClick={() => handleResetCode(s.id)} className="action-btn">Reset</button>
                          <button onClick={() => handleRegenerateCode(s.id)} className="action-btn regen-btn">🎲 Regenerate</button>
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

      <style>{`
        .teacher-dashboard { 
          padding: 2rem; 
          max-width: 1100px; 
          margin: 0 auto; 
          font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
          color: #333; 
        }
        .dashboard-nav { 
          display: flex; 
          gap: 1rem; 
          margin-bottom: 2rem; 
          border-bottom: 2px solid #eee; 
          padding-bottom: 1rem; 
        }
        .dashboard-nav button { 
          padding: 0.8rem 1.5rem; 
          border: none; 
          background: transparent; 
          cursor: pointer; 
          font-size: 1rem; 
          font-weight: 600; 
          color: #666; 
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
          background: white; 
          padding: 2rem; 
          border-radius: 16px; 
          box-shadow: 0 4px 20px rgba(0,0,0,0.08); 
          margin-bottom: 2rem; 
          border: 1px solid #f0f0f0;
        }
        .card-title { 
          font-size: 1.4rem; 
          margin-bottom: 1.5rem; 
          color: #222; 
          font-weight: 700;
          border-bottom: 2px solid #f5f5f5;
          padding-bottom: 0.75rem;
        }
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
        .student-form-footer {
          display: flex;
          justify-content: center;
          padding-top: 0.5rem;
          border-top: 1px solid #f0f0f0;
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
          border: 1px solid #ddd; 
          border-radius: 8px; 
          min-width: 180px; 
          transition: border-color 0.2s;
        }
        .input-group input:focus {
          outline: none;
          border-color: #4CAF50;
          box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2);
        }
        .generate-code-btn {
          padding: 0.5rem 1rem; 
          background: #f8f9fa; 
          border: 1px solid #ddd; 
          border-radius: 20px; 
          cursor: pointer; 
          font-size: 0.85rem; 
          color: #666; 
          transition: all 0.2s;
          font-weight: 500;
        }
        .generate-code-btn:hover { 
          background: #eef2f3; 
          color: #333; 
          border-color: #ccc;
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
          border-bottom: 1px solid #f0f0f0; 
          color: #444;
          font-size: 0.95rem;
        }
        .code-pill {
          background: #f0f0f0;
          padding: 2px 8px;
          border-radius: 4px;
          font-family: monospace;
          color: #888;
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
          background: #f8f9fa; 
          border: 1px solid #ddd; 
          border-radius: 6px; 
          cursor: pointer; 
          font-size: 0.85rem; 
          transition: all 0.2s;
        }
        .action-btn:hover { background: #eee; }
        .action-btn.regen-btn { 
          background: #fffbe6; 
          border-color: #ffe58f; 
          font-weight: 500;
        }
        .action-btn.regen-btn:hover { background: #fff8d1; }
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
          background: #f9f9f9; 
          border: 1px solid #eee; 
          border-radius: 12px; 
          position: relative; 
          transition: transform 0.1s, box-shadow 0.2s;
        }
        .need-item:hover { 
          transform: scale(1.02); 
          background: #fff; 
          box-shadow: 0 2px 8px rgba(0,0,0,0.05); 
        }
        .need-emoji { 
          font-size: 1.8rem; 
          background: white; 
          width: 50px; 
          height: 50px; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          border-radius: 10px; 
          box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
        }
        .need-info { 
          display: flex; 
          flex-direction: column; 
          flex: 1; 
        }
        .need-label { 
          font-size: 1rem; 
          color: #333; 
          font-weight: 600;
        }
        .need-msg { 
          font-size: 0.85rem; 
          color: #666; 
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
