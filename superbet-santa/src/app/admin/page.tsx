"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function AdminPanel() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [pendingBets, setPendingBets] = useState<any[]>([]);

  useEffect(() => {
    checkAdmin();
  },[]);

  const checkAdmin = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/'); return; }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
    if (profile?.role !== 'admin') { router.push('/dashboard'); return; }
    fetchData();
  };

  const fetchData = async () => {
    const [uRes, pbRes] = await Promise.all([
      supabase.from('profiles').select('*').order('balance', { ascending: false }),
      supabase.from('user_bets').select('*, profiles(nickname), bets(title)').eq('status', 'pending')
    ]);
    setUsers(uRes.data || []);
    setPendingBets(pbRes.data ||[]);
    setLoading(false);
  };

  const resolveBet = async (bet: any, won: boolean) => {
    if (!confirm(`Confirmar que a aposta foi ${won ? 'VENCIDA' : 'PERDIDA'}?`)) return;
    
    await supabase.from('user_bets').update({ status: won ? 'won' : 'lost' }).eq('id', bet.id);
    if (won) {
      const { data: user } = await supabase.from('profiles').select('balance').eq('id', bet.user_id).single();
      const newBal = (user?.balance || 0) + bet.potential_reward;
      await supabase.from('profiles').update({ balance: newBal }).eq('id', bet.user_id);
      await supabase.from('transactions').insert({
        user_id: bet.user_id, amount: bet.potential_reward, type: 'bet_won', description: `Ganho de Aposta: ${bet.bets.title}`
      });
    }
    fetchData();
  };

  const createBet = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as any;
    const options =[
      { name: form.opt1.value, odd: parseFloat(form.odd1.value) },
      { name: form.opt2.value, odd: parseFloat(form.odd2.value) }
    ];
    await supabase.from('bets').insert({
      title: form.title.value,
      has_variable: form.hasVariable.checked,
      variable_name: form.varName.value,
      options: options
    });
    alert("SuperBet Criada!");
    form.reset();
  };

  const awardChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as any;
    const userId = form.userId.value;
    const amount = parseInt(form.amount.value);
    
    const { data: user } = await supabase.from('profiles').select('balance').eq('id', userId).single();
    await supabase.from('profiles').update({ balance: (user?.balance || 0) + amount }).eq('id', userId);
    await supabase.from('transactions').insert({
      user_id: userId, amount: amount, type: 'challenge', description: form.desc.value
    });
    alert("Prêmio do Desafio enviado!");
    fetchData();
  };

  if (loading) return <div className="text-center mt-20 text-xl">Verificando permissões...</div>;

  return (
    <div className="min-h-screen p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8 bg-purple-900/50 p-6 rounded-2xl border border-purple-500/30">
        <h1 className="text-3xl font-bold text-purple-400"><i className="fa-solid fa-user-shield mr-4"></i>Painel Administrativo</h1>
        <button onClick={() => router.push('/dashboard')} className="bg-slate-700 px-4 py-2 rounded hover:bg-slate-600">Voltar ao App</button>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Criar SuperBet */}
        <div className="glass-panel p-6 rounded-xl border border-slate-700">
          <h2 className="text-xl font-bold mb-4"><i className="fa-solid fa-plus-circle mr-2 text-blue-400"></i>Criar Nova SuperBet</h2>
          <form onSubmit={createBet} className="space-y-4">
            <input name="title" placeholder="Título (ex: Chover em __)" required className="w-full bg-slate-900 border border-slate-700 p-2 rounded" />
            <div className="flex items-center gap-2">
              <input type="checkbox" name="hasVariable" id="hasVar" />
              <label htmlFor="hasVar">Tem variável (ex: nome de cidade)?</label>
            </div>
            <input name="varName" placeholder="Nome da Variável (ex: Cidade). Deixe vazio se não tiver." className="w-full bg-slate-900 border border-slate-700 p-2 rounded" />
            
            <div className="grid grid-cols-2 gap-2 p-4 bg-slate-800 rounded">
              <p className="col-span-2 text-sm text-gray-400">Opção 1</p>
              <input name="opt1" placeholder="Nome (ex: Sim)" required className="bg-slate-900 border border-slate-700 p-2 rounded" />
              <input name="odd1" type="number" step="0.1" placeholder="Odd (ex: 1.5)" required className="bg-slate-900 border border-slate-700 p-2 rounded" />
              <p className="col-span-2 text-sm text-gray-400 mt-2">Opção 2</p>
              <input name="opt2" placeholder="Nome (ex: Não)" required className="bg-slate-900 border border-slate-700 p-2 rounded" />
              <input name="odd2" type="number" step="0.1" placeholder="Odd (ex: 2.1)" required className="bg-slate-900 border border-slate-700 p-2 rounded" />
            </div>
            <button type="submit" className="w-full bg-blue-600 py-2 rounded font-bold hover:bg-blue-500">Criar SuperBet</button>
          </form>
        </div>

        {/* Premiar Desafio */}
        <div className="glass-panel p-6 rounded-xl border border-slate-700">
          <h2 className="text-xl font-bold mb-4"><i className="fa-solid fa-gift mr-2 text-orange-400"></i>Premiar Desafio a Usuário</h2>
          <form onSubmit={awardChallenge} className="space-y-4">
            <select name="userId" required className="w-full bg-slate-900 border border-slate-700 p-2 rounded">
              <option value="">Selecione o Usuário Vencedor</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.nickname} ({u.balance} MP)</option>)}
            </select>
            <input name="desc" placeholder="Motivo/Nome do Desafio" required className="w-full bg-slate-900 border border-slate-700 p-2 rounded" />
            <input name="amount" type="number" placeholder="Valor do Prêmio (MP)" required className="w-full bg-slate-900 border border-slate-700 p-2 rounded" />
            <button type="submit" className="w-full bg-orange-600 py-2 rounded font-bold hover:bg-orange-500">Enviar Prêmio</button>
          </form>
        </div>

        {/* Resolver Apostas */}
        <div className="md:col-span-2 glass-panel p-6 rounded-xl border border-slate-700">
          <h2 className="text-xl font-bold mb-4"><i className="fa-solid fa-gavel mr-2 text-red-400"></i>Resolver Apostas Pendentes</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead><tr className="border-b border-slate-600"><th className="pb-2">Usuário</th><th className="pb-2">Aposta & Escolha</th><th className="pb-2">Data Alvo</th><th className="pb-2">Prêmio Potencial</th><th className="pb-2 text-right">Ação</th></tr></thead>
              <tbody>
                {pendingBets.map(bet => (
                  <tr key={bet.id} className="border-b border-slate-800">
                    <td className="py-3 font-medium">{bet.profiles.nickname}</td>
                    <td><div className="text-sm font-bold">{bet.bets.title}</div><div className="text-xs text-gray-400">{bet.selected_option}</div></td>
                    <td>{bet.selected_date}</td>
                    <td className="text-emerald-400 font-bold">{bet.potential_reward} MP</td>
                    <td className="text-right space-x-2">
                      <button onClick={() => resolveBet(bet, true)} className="bg-emerald-600 hover:bg-emerald-500 px-3 py-1 rounded text-sm"><i className="fa-solid fa-check mr-1"></i>Ganhou</button>
                      <button onClick={() => resolveBet(bet, false)} className="bg-red-600 hover:bg-red-500 px-3 py-1 rounded text-sm"><i className="fa-solid fa-xmark mr-1"></i>Perdeu</button>
                    </td>
                  </tr>
                ))}
                {pendingBets.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-gray-500">Nenhuma aposta pendente para resolver.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}