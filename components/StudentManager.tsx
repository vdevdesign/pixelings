import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

interface Student {
  id: string;
  username: string;
  approved_nickname: string;
  access_code_hash: string;
}

export const StudentManager: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newStudent, setNewStudent] = useState({ name: '', code: '' });

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

  useEffect(() => { fetchStudents(); }, []);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.name || !newStudent.code) return;

    setError('');
    const { error: rpcError } = await supabase.rpc('create_student_profile', {
      first_name: newStudent.name,
      access_code: newStudent.code,
    });

    if (rpcError) setError(rpcError.message);
    else setNewStudent({ name: '', code: '' });
    await fetchStudents();
  };

  const handleResetCode = async (id: string) => {
    const newCode = prompt('Enter new access code (4-12 digits):');
    if (!newCode) return;

    setError('');
    const { error: rpcError } = await supabase.rpc('reset_student_code', {
      student_id: id,
      new_code: newCode,
    });

    if (rpcError) setError(rpcError.message);
  };

  const handleDeleteStudent = async (id: string) => {
    if (!confirm('Remove this student? Their profile, wallet and inventory will be deleted.')) return;

    setError('');
    const { error: rpcError } = await supabase.rpc('delete_student', {
      student_id: id,
    });

    if (rpcError) setError(rpcError.message);
    else await fetchStudents();
  };

  if (loading) return <div className="manager-loading">Loading Students...</div>;

  return (
    <div className="student-manager-container">
      <header className="manager-header">
        <h1>Student Manager</h1>
        <p>Manage classroom profiles and access codes.</p>
      </header>

      <div className="manager-card">
        <h2>Add New Student</h2>
        <form onSubmit={handleAddStudent} className="student-form">
          <div className="input-group">
            <label>First Name</label>
            <input 
              value={newStudent.name} 
              onChange={e => setNewStudent({...newStudent, name: e.target.value})}
              placeholder="e.g. Maya"
            />
          </div>
          <div className="input-group">
            <label>Access Code</label>
            <input 
              value={newStudent.code} 
              onChange={e => setNewStudent({...newStudent, code: e.target.value})}
              placeholder="e.g. 123456"
            />
          </div>
          <button type="submit" className="submit-btn">Add Student</button>
        </form>
        {error && <div className="manager-error">{error}</div>}
      </div>

      <div className="student-list-card">
        <h2>Class Roster</h2>
        <table className="student-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Nickname</th>
              <th>Code</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.map(s => (
              <tr key={s.id}>
                <td>{s.username}</td>
                <td>{s.approved_nickname || '-'}</td>
                <td>••••••</td>
                <td>
                  <button onClick={() => handleResetCode(s.id)} className="action-btn">Reset Code</button>{' '}
                  <button onClick={() => handleDeleteStudent(s.id)} className="action-btn remove-btn">Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style>{`
        .student-manager-container { padding: 2rem; max-width: 1000px; margin: 0 auto; font-family: sans-serif; }
        .manager-header { margin-bottom: 2rem; text-align: center; }
        .manager-card, .student-list-card { 
          background: white; padding: 1.5rem; border-radius: 12px; 
          box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin-bottom: 2rem; 
        }
        .student-form { display: flex; gap: 1rem; align-items: flex-end; }
        .input-group { display: flex; flex-direction: column; gap: 0.5rem; }
        .input-group input { padding: 0.6rem; border: 1px solid #ccc; border-radius: 6px; }
        .submit-btn { 
          padding: 0.6rem 1.2rem; background: #4CAF50; color: white; 
          border: none; border-radius: 6px; cursor: pointer; font-weight: bold;
        }
        .student-table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
        .student-table th, .student-table td { 
          text-align: left; padding: 0.8rem; border-bottom: 1px solid #eee; 
        }
        .action-btn { 
          padding: 0.4rem 0.8rem; background: #eee; border: 1px solid #ccc; 
          border-radius: 4px; cursor: pointer; 
        }
        .remove-btn { color: #b91c1c; border-color: #fca5a5; }
        .manager-error { color: red; margin-top: 1rem; font-size: 0.9rem; }
      `}</style>
    </div>
  );
};
