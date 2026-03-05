"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

export default function Dashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('superbet');
  const [loading, setLoading] = useState(true);
  
  // Dados
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [bets, setBets] = useState<any[]>([]);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [ranking, setRanking] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  // Formulário de Aposta
  const [selectedBet, setSelectedBet] = useState<any>(null);
  const[betDate, setBetDate] = useState('');
  const [betAmount, setBetAmount] = useState('');
  const[betVariable, setBetVariable] = useState('');
  const [betOptionIndex, setBetOptionIndex] = useState(0);

  useEffect(() => {
    fetchData();
  },[]);

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/'); return; }
    setUser(session.user);

    const[profRes, betsRes, chalRes, rankRes, transRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', session.user.id).single(),
      supabase.from('bets').select('*').eq('is_active', true),
      supabase.from('challenges').select('*').eq('is_active', true),
      supabase.from('profiles').select('nickname, balance').order('balance', { ascending: false }).limit(50),
      supabase.from('transactions').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false })
    ]);

    setProfile(profRes.data);
    setBets(betsRes.data || []);
    setChallenges(chalRes.data ||[]);
    setRanking(rankRes.data || []);
    setTransactions(transRes.data ||[]);
    setLoading(false);
  };

  const claimDailyBonus = async () => {
    const today = new Date().toISOString().split('T')[0];
    if (profile.last_bonus_date === today) {
      alert("Você já resgatou o bônus de hoje!");
      return;
    }
    const bonusAmount = 100; // 100 michapoints
    const newBalance = profile.balance + bonusAmount;

    await supabase.from('profiles').update({ balance: newBalance, last_bonus_date: today }).eq('id', user.id);
    await supabase.from('transactions').insert({
      user_id: user.id, amount: bonusAmount, type: 'bonus', description: 'Bônus Diário de Login'
    });
    
    alert(`Bônus resgatado! +${bonusAmount} michapoints`);
    fetchData();
  };

  const placeBet = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(betAmount);
    if (amount <= 0 || amount > profile.balance) { alert("Saldo insuficiente ou valor inválido."); return; }
    
    const optionSelected = selectedBet.options[betOptionIndex];
    let finalSelectionName = optionSelected.name;
    if (selectedBet.has_variable && betVariable) {
      finalSelectionName = finalSelectionName.replace('__', betVariable);
    }

    const potentialReward = Math.round(amount * optionSelected.odd);

    await supabase.from('profiles').update({ balance: profile.balance - amount }).eq('id', user.id);
    await supabase.from('user_bets').insert({
      user_id: user.id, bet_id: selectedBet.id, selected_option: finalSelectionName,
      selected_date: betDate, amount_wagered: amount, potential_reward: potentialReward
    });
    await supabase.from('transactions').insert({
      user_id: user.id, amount: -amount, type: 'bet_placed', description: `Aposta: ${selectedBet.title}`
    });

    alert("Aposta registrada com sucesso!");
    setSelectedBet(null);
    fetchData();
  };

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as any;
    const newNick = form.nickname.value;
    await supabase.from('profiles').update({ nickname: newNick }).eq('id', user.id);
    alert("Perfil atualizado!");
    fetchData();
  };

  if (loading) return <div className="min-h-screen flex justify-center items-center"><div className="loader"></div></div>;

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="glass-panel p-4 sticky top-0 z-50 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-3">
          <i className="fa-solid fa-bolt text-blue-500 text-2xl"></i>
          <h1 className="text-xl font-bold hidden sm:block">SuperBet: Santa</h1>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-sm text-gray-400"><i className="fa-solid fa-user mr-2"></i>{profile?.nickname}</div>
            <div className="text-emerald-400 font-bold"><i className="fa-solid fa-coins mr-2"></i>{profile?.balance} MP</div>
          </div>
          {profile?.role === 'admin' && (
            <button onClick={() => router.push('/admin')} className="bg-purple-600 hover:bg-purple-700 px-3 py-1 text-sm rounded transition">
              <i className="fa-solid fa-screwdriver-wrench mr-2"></i>Admin
            </button>
          )}
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/'); }} className="text-gray-400 hover:text-red-400 transition">
            <i className="fa-solid fa-right-from-bracket text-xl"></i>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto mt-8 px-4">
        
        {/* Navigation */}
        <div className="flex overflow-x-auto gap-2 mb-8 bg-slate-800/50 p-2 rounded-xl glass-panel">
          {[
            { id: 'superbet', icon: 'fa-crosshairs', label: 'SuperBets' },
            { id: 'bonus', icon: 'fa-gift', label: 'Bônus & Desafios' },
            { id: 'ranking', icon: 'fa-trophy', label: 'Ranking Geral' },
            { id: 'profile', icon: 'fa-file-invoice-dollar', label: 'Perfil & Extrato' }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[120px] py-3 rounded-lg font-medium transition-all flex flex-col items-center gap-2
              ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-700 text-gray-400'}`}>
              <i className={`fa-solid ${tab.icon} text-xl`}></i>
              <span className="text-xs uppercase tracking-wider">{tab.label}</span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* TAB: SUPERBET */}
          {activeTab === 'superbet' && (
            <motion.div key="superbet" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <h2 className="text-2xl font-bold mb-6 border-b border-slate-700 pb-2"><i className="fa-solid fa-crosshairs mr-3 text-blue-500"></i>Apostas Disponíveis</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {bets.map(bet => (
                  <div key={bet.id} className="glass-panel p-5 rounded-xl cursor-pointer hover:border-blue-500 transition-colors group" onClick={() => { setSelectedBet(bet); setBetOptionIndex(0); setBetVariable(''); }}>
                    <h3 className="text-lg font-bold group-hover:text-blue-400 transition-colors">{bet.title}</h3>
                    <p className="text-sm text-gray-400 mt-2"><i className="fa-solid fa-calendar-days mr-2"></i>Escolha o dia da previsão</p>
                    {bet.has_variable && <p className="text-xs text-blue-400 mt-1"><i className="fa-solid fa-font mr-1"></i>Aposta Variável ({bet.variable_name})</p>}
                  </div>
                ))}
              </div>

              {/* Modal de Aposta */}
              {selectedBet && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
                  <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="glass-panel p-6 rounded-2xl w-full max-w-lg bg-slate-800">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold">{selectedBet.title}</h3>
                      <button onClick={() => setSelectedBet(null)} className="text-gray-400 hover:text-white"><i className="fa-solid fa-xmark text-xl"></i></button>
                    </div>
                    <form onSubmit={placeBet} className="space-y-4">
                      {selectedBet.has_variable && (
                        <div>
                          <label className="block text-sm mb-1">{selectedBet.variable_name}</label>
                          <input type="text" required value={betVariable} onChange={e => setBetVariable(e.target.value)} placeholder="Ex: São Paulo" className="w-full bg-slate-900 border border-slate-700 rounded p-3" />
                        </div>
                      )}
                      <div>
                        <label className="block text-sm mb-1">Selecione o Resultado</label>
                        <select className="w-full bg-slate-900 border border-slate-700 rounded p-3" onChange={e => setBetOptionIndex(Number(e.target.value))}>
                          {selectedBet.options.map((opt:any, idx:number) => (
                            <option key={idx} value={idx}>{opt.name.replace('__', betVariable || '___')} - Odd: {opt.odd}x</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm mb-1">Para qual data?</label>
                        <input type="date" required value={betDate} onChange={e => setBetDate(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded p-3" />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">Valor da Aposta (Michapoints)</label>
                        <input type="number" required min="1" max={profile?.balance} value={betAmount} onChange={e => setBetAmount(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded p-3" />
                      </div>
                      <div className="bg-slate-900 p-3 rounded text-center">
                        <span className="text-sm text-gray-400">Retorno Possível: </span>
                        <span className="font-bold text-emerald-400">{Math.round(Number(betAmount || 0) * (selectedBet.options[betOptionIndex]?.odd || 1))} MP</span>
                      </div>
                      <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors">
                        Confirmar Aposta
                      </button>
                    </form>
                  </motion.div>
                </div>
              )}
            </motion.div>
          )}

          {/* TAB: BONUS E DESAFIOS */}
          {activeTab === 'bonus' && (
            <motion.div key="bonus" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <div className="glass-panel p-8 rounded-2xl text-center mb-8 bg-gradient-to-br from-slate-800 to-slate-900 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                <i className="fa-solid fa-calendar-check text-5xl text-emerald-400 mb-4"></i>
                <h2 className="text-2xl font-bold mb-2">Bônus Diário de Login</h2>
                <p className="text-gray-400 mb-6">Entre todos os dias e resgate seus Michapoints grátis!</p>
                <button onClick={claimDailyBonus} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-8 rounded-full text-lg shadow-lg shadow-emerald-600/30 transition-all hover:scale-105 active:scale-95">
                  Resgatar Bônus Hoje
                </button>
              </div>

              <h2 className="text-2xl font-bold mb-4 border-b border-slate-700 pb-2"><i className="fa-solid fa-medal mr-3 text-orange-400"></i>Desafios Ativos</h2>
              <div className="grid gap-4">
                {challenges.map(chal => (
                  <div key={chal.id} className="glass-panel p-5 rounded-xl border-l-4 border-orange-500 flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-orange-500/20 text-orange-400 text-xs px-2 py-1 rounded uppercase font-bold">{chal.type}</span>
                        <h3 className="text-lg font-bold">{chal.title}</h3>
                      </div>
                      <p className="text-sm text-gray-400">{chal.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-400">Prêmio</div>
                      <div className="text-xl font-bold text-emerald-400">+{chal.reward} MP</div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* TAB: RANKING */}
          {activeTab === 'ranking' && (
            <motion.div key="ranking" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <h2 className="text-2xl font-bold mb-6 border-b border-slate-700 pb-2"><i className="fa-solid fa-trophy mr-3 text-yellow-500"></i>Ranking Global</h2>
              <div className="glass-panel rounded-xl overflow-hidden">
                {ranking.map((rk, idx) => (
                  <div key={idx} className={`flex items-center justify-between p-4 border-b border-slate-700/50 ${idx === 0 ? 'bg-yellow-500/10' : ''} ${rk.nickname === profile?.nickname ? 'bg-blue-500/10 border-l-4 border-l-blue-500' : ''}`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${idx === 0 ? 'bg-yellow-500 text-black' : idx === 1 ? 'bg-gray-300 text-black' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-700 text-gray-400'}`}>
                        {idx + 1}
                      </div>
                      <span className="font-medium text-lg">{rk.nickname}</span>
                    </div>
                    <span className="font-bold text-emerald-400">{rk.balance} MP</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* TAB: PERFIL E EXTRATO */}
          {activeTab === 'profile' && (
            <motion.div key="profile" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="grid md:grid-cols-3 gap-6">
              <div className="md:col-span-1">
                <div className="glass-panel p-6 rounded-xl">
                  <h2 className="text-xl font-bold mb-4 border-b border-slate-700 pb-2"><i className="fa-solid fa-user-pen mr-2"></i>Editar Perfil</h2>
                  <form onSubmit={updateProfile} className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Nickname</label>
                      <input type="text" name="nickname" defaultValue={profile?.nickname} required className="w-full bg-slate-900 border border-slate-700 rounded p-3 focus:border-blue-500 outline-none" />
                    </div>
                    <button type="submit" className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2 rounded transition">Salvar Alterações</button>
                  </form>
                </div>
              </div>

              <div className="md:col-span-2">
                <div className="glass-panel p-6 rounded-xl h-[600px] flex flex-col">
                  <h2 className="text-xl font-bold mb-4 border-b border-slate-700 pb-2"><i className="fa-solid fa-receipt mr-2"></i>Extrato Completo</h2>
                  <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                    {transactions.map(tx => (
                      <div key={tx.id} className="bg-slate-800/50 p-3 rounded flex justify-between items-center border-l-2 border-slate-600">
                        <div>
                          <p className="text-sm font-medium">{tx.description}</p>
                          <p className="text-xs text-gray-500">{new Date(tx.created_at).toLocaleString()}</p>
                        </div>
                        <span className={`font-bold ${tx.amount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {tx.amount > 0 ? '+' : ''}{tx.amount}
                        </span>
                      </div>
                    ))}
                    {transactions.length === 0 && <p className="text-gray-500 text-center mt-10">Nenhuma transação encontrada.</p>}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}