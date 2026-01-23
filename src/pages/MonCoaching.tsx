import React, { useState, useEffect } from 'react';
import { Users, Target, Star, TrendingUp, Calendar, User, BookOpen, Award, ChevronDown, ChevronRight, Eye, CheckCircle, AlertCircle, Edit, Trash2, Plus, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import AnnualEvaluationCoachModal from '../components/objectives/AnnualEvaluationCoachModal';

interface CoachingEvaluation {
  evaluation_id: string;
  objectifs_id: string;
  auto_evaluation: any;
  evaluation_referent: any;
  statut: string;
  date_soumission: string;
  created_at: string;
  updated_at: string;
  employe_id: string;
  employe_nom: string;
  employe_role: string;
  employe_department: string;
  coach_id: string;
  projet_id: string;
  projet_titre: string;
  nom_client: string;
  projet_statut: string;
  referent_projet_id: string;
  referent_nom: string;
  objectifs: any[];
  score_auto_evaluation: number;
  score_referent: number;
  note_finale: number;
}

interface AnnualObjective {
  id: string;
  employee_id: string;
  year: number;
  career_pathway_id: string;
  career_level_id: string;
  selected_themes: string[];
  objectives: any[];
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'waiting auto evaluation' | 'evaluated';
  created_at: string;
  updated_at: string;
  employee: {
    full_name: string;
    role: string;
  };
  career_pathway: {
    name: string;
    color: string;
  };
  career_level: {
    name: string;
    color: string;
  };
}

interface AnnualEvaluation {
  id: string;
  annual_objective_id: string;
  employee_id: string;
  year: number;
  evaluations: any[];
  employee_global_comment: string;
  employee_global_score: number;
  status: 'draft' | 'submitted' | 'reviewed';
  submitted_at: string;
  created_at: string;
  updated_at: string;
  annual_objective: AnnualObjective;
}

interface CoachEvaluation {
  id: string;
  annual_evaluation_id: string;
  annual_objective_id: string;
  coach_id: string;
  employee_id: string;
  year: number;
  coach_evaluations: any[];
  coach_global_comment: string;
  coach_global_score: number;
  status: 'draft' | 'in_progress' | 'completed';
  completed_at: string;
  created_at: string;
}

const MonCoaching = () => {
  const { t } = useTranslation();
  const [evaluations, setEvaluations] = useState<CoachingEvaluation[]>([]);
  const [annualObjectives, setAnnualObjectives] = useState<AnnualObjective[]>([]);
  const [annualEvaluations, setAnnualEvaluations] = useState<AnnualEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [expandedEvaluations, setExpandedEvaluations] = useState<Set<string>>(new Set());
  const [expandedObjectives, setExpandedObjectives] = useState<Set<string>>(new Set());
  const [expandedAnnualEvaluations, setExpandedAnnualEvaluations] = useState<Set<string>>(new Set());
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'evaluations' | 'objectives' | 'annual_evaluations'>('evaluations');
  const [showCoachEvaluationModal, setShowCoachEvaluationModal] = useState(false);
  const [selectedEvaluationForCoach, setSelectedEvaluationForCoach] = useState<{objective: AnnualObjective, employeeEvaluation: AnnualEvaluation} | null>(null);

  useEffect(() => {
    checkUserAndFetchData();
  }, []);

  const checkUserAndFetchData = async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t('common.notLoggedIn'));

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!profile) throw new Error(t('common.profileNotFound'));

      setCurrentUser(profile);
      await fetchCoachingEvaluations(user.id);
      await fetchAnnualObjectives(user.id);
      await fetchAnnualEvaluations(user.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.loadingError'));
    } finally {
      setLoading(false);
    }
  };

  const fetchCoachingEvaluations = async (coachId: string) => {
    try {
      const { data, error } = await supabase
        .from('v_coaching_evaluations')
        .select('*')
        .eq('coach_id', coachId)
        .order('date_soumission', { ascending: false });

      if (error) throw error;
      setEvaluations(data || []);
    } catch (err) {
      console.error('Error fetching coaching evaluations:', err);
      setError(t('coaching.errorFetchingEvaluations'));
    }
  };

  const fetchAnnualObjectives = async (coachId: string) => {
    try {
      // Récupérer les IDs des coachés
      const { data: coachees, error: coacheesError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('coach_id', coachId);

      if (coacheesError) throw coacheesError;

      if (!coachees || coachees.length === 0) {
        setAnnualObjectives([]);
        return;
      }

      const coacheeIds = coachees.map(coachee => coachee.id);

      // Récupérer les objectifs annuels des coachés
      const { data: objectives, error: objectivesError } = await supabase
        .from('annual_objectives')
        .select(`
          *,
          employee:user_profiles!employee_id(full_name, role),
          career_pathway:career_areas!career_pathway_id(name, color),
          career_level:career_levels!career_level_id(name, color)
        `)
        .in('employee_id', coacheeIds)
        .order('created_at', { ascending: false });

      if (objectivesError) throw objectivesError;
      setAnnualObjectives(objectives || []);
    } catch (err) {
      console.error('Error fetching annual objectives:', err);
      setError('Erreur lors du chargement des objectifs annuels');
    }
  };

  const fetchAnnualEvaluations = async (coachId: string) => {
    try {
      // Récupérer les IDs des coachés
      const { data: coachees, error: coacheesError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('coach_id', coachId);

      if (coacheesError) throw coacheesError;

      if (!coachees || coachees.length === 0) {
        setAnnualEvaluations([]);
        return;
      }

      const coacheeIds = coachees.map(coachee => coachee.id);

      // Récupérer les évaluations annuelles des coachés
      const { data: evaluationsData, error: evaluationsError } = await supabase
        .from('annual_evaluations')
        .select(`
          *,
          annual_objective:annual_objectives!annual_objective_id(
            *,
            employee:user_profiles!employee_id(full_name, role),
            career_pathway:career_areas!career_pathway_id(name, color),
            career_level:career_levels!career_level_id(name, color)
          )
        `)
        .in('employee_id', coacheeIds)
        .eq('status', 'submitted')
        .order('submitted_at', { ascending: false });

      if (evaluationsError) throw evaluationsError;
      setAnnualEvaluations(evaluationsData || []);
    } catch (err) {
      console.error('Error fetching annual evaluations:', err);
      setError('Erreur lors du chargement des évaluations annuelles');
    }
  };

  const toggleEvaluationExpansion = (evaluationId: string) => {
    setExpandedEvaluations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(evaluationId)) {
        newSet.delete(evaluationId);
      } else {
        newSet.add(evaluationId);
      }
      return newSet;
    });
  };

  const toggleObjectiveExpansion = (objectiveId: string) => {
    setExpandedObjectives(prev => {
      const newSet = new Set(prev);
      if (newSet.has(objectiveId)) {
        newSet.delete(objectiveId);
      } else {
        newSet.add(objectiveId);
      }
      return newSet;
    });
  };

  const toggleAnnualEvaluationExpansion = (evaluationId: string) => {
    setExpandedAnnualEvaluations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(evaluationId)) {
        newSet.delete(evaluationId);
      } else {
        newSet.add(evaluationId);
      }
      return newSet;
    });
  };

  const handleStartCoachEvaluation = (evaluation: AnnualEvaluation) => {
    setSelectedEvaluationForCoach({
      objective: evaluation.annual_objective,
      employeeEvaluation: evaluation
    });
    setShowCoachEvaluationModal(true);
  };

  const handleCoachEvaluationCompleted = () => {
    setShowCoachEvaluationModal(false);
    setSelectedEvaluationForCoach(null);
    setSuccess('Évaluation coach enregistrée avec succès');
    if (currentUser) {
      fetchAnnualEvaluations(currentUser.id);
      fetchAnnualObjectives(currentUser.id);
    }
    setTimeout(() => setSuccess(null), 3000);
  };

  const getScoreStars = (score: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star 
        key={i} 
        className={`w-4 h-4 ${i < score ? 'fill-current text-yellow-400' : 'text-gray-300'}`} 
      />
    ));
  };

  const getScoreColor = (score: number) => {
    if (score >= 4.5) return 'text-green-600';
    if (score >= 3.5) return 'text-blue-600';
    if (score >= 2.5) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 4.5) return 'bg-green-100 text-green-800';
    if (score >= 3.5) return 'bg-blue-100 text-blue-800';
    if (score >= 2.5) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'submitted':
        return 'bg-blue-100 text-blue-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Brouillon';
      case 'submitted':
        return 'Soumis';
      case 'approved':
        return 'Approuvé';
      case 'rejected':
        return 'Rejeté';
      default:
        return status;
    }
  };

  const getUniqueEmployees = () => {
    const employeesFromEvaluations = evaluations.reduce((acc, currentEval) => {
      if (!acc.find(emp => emp.id === currentEval.employe_id)) {
        acc.push({
          id: currentEval.employe_id,
          name: currentEval.employe_nom,
          role: currentEval.employe_role,
          department: currentEval.employe_department
        });
      }
      return acc;
    }, [] as any[]);

    const employeesFromObjectives = annualObjectives.reduce((acc, objective) => {
      if (!acc.find(emp => emp.id === objective.employee_id)) {
        acc.push({
          id: objective.employee_id,
          name: objective.employee.full_name,
          role: objective.employee.role,
          department: ''
        });
      }
      return acc;
    }, [] as any[]);

    // Fusionner les deux listes
    const allEmployees = [...employeesFromEvaluations];
    
    employeesFromObjectives.forEach(empObj => {
      if (!allEmployees.find(emp => emp.id === empObj.id)) {
        allEmployees.push(empObj);
      }
    });

    return allEmployees;
  };

  const handleApproveObjective = async (objective: AnnualObjective) => {
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('annual_objectives')
        .update({ status: 'approved' })
        .eq('id', objective.id);
      
      if (error) throw error;
      
      setSuccess(`Objectifs de ${objective.employee.full_name} approuvés avec succès`);
      fetchAnnualObjectives(currentUser.id);
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'approbation des objectifs');
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectObjective = async (objective: AnnualObjective) => {
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('annual_objectives')
        .update({ status: 'rejected' })
        .eq('id', objective.id);
      
      if (error) throw error;
      
      setSuccess(`Objectifs de ${objective.employee.full_name} rejetés`);
      fetchAnnualObjectives(currentUser.id);
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du rejet des objectifs');
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const filteredEvaluations = selectedEmployee
    ? evaluations.filter(currentEval => currentEval.employe_id === selectedEmployee)
    : evaluations;

  const filteredObjectives = selectedEmployee
    ? annualObjectives.filter(objective => objective.employee_id === selectedEmployee)
    : annualObjectives;

  const filteredAnnualEvaluations = selectedEmployee
    ? annualEvaluations.filter(evaluation => evaluation.employee_id === selectedEmployee)
    : annualEvaluations;

  const getEmployeeStats = (employeeId: string) => {
    const employeeEvals = evaluations.filter(currentEval => currentEval.employe_id === employeeId);
    const avgScore = employeeEvals.length > 0 
      ? employeeEvals.reduce((sum, currentEval) => sum + currentEval.note_finale, 0) / employeeEvals.length
      : 0;
    return {
      totalEvaluations: employeeEvals.length,
      averageScore: avgScore,
      lastEvaluation: employeeEvals[0]?.date_soumission
    };
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('coaching.title')}</h1>
          <p className="text-gray-600 mt-1">{t('coaching.subtitle')}</p>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 text-green-700 p-4 rounded-lg border border-green-200">
          {success}
        </div>
      )}

      {/* Statistiques globales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Users className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">{t('coaching.coachees')}</p>
              <p className="text-2xl font-bold text-gray-900">{getUniqueEmployees().length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Target className="w-5 h-5 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">{t('coaching.evaluations')}</p>
              <p className="text-2xl font-bold text-gray-900">{evaluations.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Star className="w-5 h-5 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">{t('coaching.averageScore')}</p>
              <p className="text-2xl font-bold text-gray-900">
                {evaluations.length > 0 
                  ? (evaluations.reduce((sum, currentEval) => sum + currentEval.note_finale, 0) / evaluations.length).toFixed(1)
                  : '0.0'
                }/5
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Objectifs annuels</p>
              <p className="text-2xl font-bold text-gray-900">
                {annualObjectives.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('evaluations')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'evaluations'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5" />
              Évaluations de projets
              <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded-full">
                {evaluations.length}
              </span>
            </div>
          </button>
          
          <button
            onClick={() => setActiveTab('objectives')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'objectives'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Objectifs annuels
              <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded-full">
                {annualObjectives.length}
              </span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('annual_evaluations')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'annual_evaluations'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5" />
              Évaluations annuelles
              <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded-full">
                {annualEvaluations.length}
              </span>
            </div>
          </button>
        </nav>
      </div>

      {/* Filtre par employé */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">{t('coaching.filterByCoachee')}:</label>
          <select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">{t('coaching.allCoachees')}</option>
            {getUniqueEmployees().map(employee => (
              <option key={employee.id} value={employee.id}>
                {employee.name} ({employee.role})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Vue d'ensemble des coachés */}
      {!selectedEmployee && (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">{t('coaching.coacheesOverview')}</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {getUniqueEmployees().map(employee => {
                const stats = getEmployeeStats(employee.id);
                return (
                  <div key={employee.id} className="bg-gray-50 rounded-lg p-4 border">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-medium text-gray-900">{employee.name}</h3>
                        <p className="text-sm text-gray-600">{employee.role}</p>
                        {employee.department && (
                          <p className="text-xs text-gray-500">{employee.department}</p>
                        )}
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getScoreBadgeColor(stats.averageScore)}`}>
                        {stats.averageScore.toFixed(1)}/5
                      </span>
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
                      <div className="flex justify-between">
                        <span>{t('coaching.evaluations')}:</span>
                        <span>{stats.totalEvaluations}</span>
                      </div>
                      {stats.lastEvaluation && (
                        <div className="flex justify-between">
                          <span>{t('coaching.lastEvaluation')}:</span>
                          <span>{format(new Date(stats.lastEvaluation), 'dd/MM/yyyy', { locale: fr })}</span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedEmployee(employee.id)}
                      className="mt-3 w-full px-3 py-1 bg-indigo-100 text-indigo-700 rounded text-sm hover:bg-indigo-200 transition-colors"
                    >
                      {t('coaching.seeDetails')}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Contenu des onglets */}
      {activeTab === 'evaluations' && (
        <div className="space-y-4">
          {filteredEvaluations.length > 0 ? (
            filteredEvaluations.map((evaluation) => {
              const isExpanded = expandedEvaluations.has(evaluation.evaluation_id);
              
              return (
                <div key={evaluation.evaluation_id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Award className="w-5 h-5 text-indigo-600" />
                          <h3 className="text-lg font-semibold text-gray-900">
                            {evaluation.projet_titre}
                          </h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getScoreBadgeColor(evaluation.note_finale)}`}>
                            {t('coaching.finalScore')}: {evaluation.note_finale}/5
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            <span>{evaluation.employe_nom}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4" />
                            <span>{t('projects.clientName')}: {evaluation.nom_client}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>{t('evaluation.evaluatedOn')} {format(new Date(evaluation.date_soumission), 'dd/MM/yyyy', { locale: fr })}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleEvaluationExpansion(evaluation.evaluation_id)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                    </div>

                    {/* Résumé des scores */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="bg-blue-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-blue-800">{t('coaching.selfEvaluation')}</span>
                          <span className="text-sm font-bold text-blue-800">{evaluation.score_auto_evaluation}/5</span>
                        </div>
                        <div className="flex">
                          {getScoreStars(evaluation.score_auto_evaluation)}
                        </div>
                      </div>
                      <div className="bg-green-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-green-800">{t('coaching.referentEvaluation')}</span>
                          <span className="text-sm font-bold text-green-800">{evaluation.score_referent}/5</span>
                        </div>
                        <div className="flex">
                          {getScoreStars(evaluation.score_referent)}
                        </div>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-purple-800">{t('coaching.finalScore')}</span>
                          <span className="text-sm font-bold text-purple-800">{evaluation.note_finale}/5</span>
                        </div>
                        <div className="flex">
                          {getScoreStars(evaluation.note_finale)}
                        </div>
                      </div>
                    </div>

                    {/* Détails des évaluations */}
                    {isExpanded && (
                      <div className="border-t pt-4 space-y-6">
                        <div>
                          <h4 className="font-medium text-gray-900 mb-3">
                            {t('objectives.evaluatedObjectives')} ({evaluation.objectifs.length})
                          </h4>
                          <div className="space-y-4">
                            {evaluation.objectifs.map((objective: any, index: number) => {
                              const autoEval = evaluation.auto_evaluation?.evaluations?.[index];
                              const referentEval = evaluation.evaluation_referent?.evaluations?.[index];
                              
                              return (
                                <div key={index} className="bg-gray-50 rounded-lg p-4">
                                  <div className="mb-3">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
                                        {objective.theme_name}
                                      </span>
                                    </div>
                                    <h5 className="font-medium text-gray-900">
                                      {index + 1}. {objective.skill_description}
                                    </h5>
                                  </div>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Auto-évaluation */}
                                    {autoEval && (
                                      <div className="bg-blue-50 rounded p-3">
                                        <h6 className="text-sm font-medium text-blue-800 mb-2">{t('coaching.selfEvaluation')}</h6>
                                        <div className="flex items-center gap-2 mb-2">
                                          <div className="flex">
                                            {getScoreStars(autoEval.auto_evaluation_score)}
                                          </div>
                                          <span className="text-sm text-blue-700">({autoEval.auto_evaluation_score}/5)</span>
                                        </div>
                                        <p className="text-sm text-blue-700">{autoEval.auto_evaluation_comment}</p>
                                        {autoEval.achievements && (
                                          <p className="text-sm text-blue-700 mt-1">
                                            <strong>{t('evaluation.achievements')}:</strong> {autoEval.achievements}
                                          </p>
                                        )}
                                      </div>
                                    )}
                                    
                                    {/* Évaluation référent */}
                                    {referentEval && (
                                      <div className="bg-green-50 rounded p-3">
                                        <h6 className="text-sm font-medium text-green-800 mb-2">{t('coaching.referentEvaluation')}</h6>
                                        <div className="flex items-center gap-2 mb-2">
                                          <div className="flex">
                                            {getScoreStars(referentEval.referent_score)}
                                          </div>
                                          <span className="text-sm text-green-700">({referentEval.referent_score}/5)</span>
                                        </div>
                                        <p className="text-sm text-green-700">{referentEval.referent_comment}</p>
                                        {referentEval.observed_achievements && (
                                          <p className="text-sm text-green-700 mt-1">
                                            <strong>{t('evaluation.observations')}:</strong> {referentEval.observed_achievements}
                                          </p>
                                        )}
                                        {referentEval.development_recommendations && (
                                          <p className="text-sm text-green-700 mt-1">
                                            <strong>{t('evaluation.recommendations')}:</strong> {referentEval.development_recommendations}
                                          </p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Synthèse pour le coaching */}
                        <div className="bg-purple-50 rounded-lg p-4">
                          <h4 className="font-medium text-purple-800 mb-3">{t('coaching.coachingSummary')}</h4>
                          <div className="space-y-2 text-sm text-purple-700">
                            <div className="flex justify-between">
                              <span>{t('coaching.selfReferentGap')}:</span>
                              <span className={`font-medium ${Math.abs(evaluation.score_auto_evaluation - evaluation.score_referent) > 1 ? 'text-red-600' : 'text-green-600'}`}>
                                {(evaluation.score_referent - evaluation.score_auto_evaluation).toFixed(1)} {t('coaching.points')}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>{t('coaching.selfEvaluationTrend')}:</span>
                              <span className={`font-medium ${evaluation.score_auto_evaluation > evaluation.score_referent ? 'text-orange-600' : evaluation.score_auto_evaluation < evaluation.score_referent ? 'text-blue-600' : 'text-green-600'}`}>
                                {evaluation.score_auto_evaluation > evaluation.score_referent ? t('coaching.overestimation') : 
                                 evaluation.score_auto_evaluation < evaluation.score_referent ? t('coaching.underestimation') : t('coaching.aligned')}
                              </span>
                            </div>
                            <div className="mt-3 p-3 bg-white rounded border-l-4 border-purple-400">
                              <p className="text-sm text-gray-700">
                                <strong>{t('coaching.suggestedCoachingPoints')}:</strong>
                                {Math.abs(evaluation.score_auto_evaluation - evaluation.score_referent) > 1 
                                  ? t('coaching.discussGap')
                                  : t('coaching.congratulateAlignment')
                                }
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 bg-white rounded-lg shadow-sm border">
              <Award className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">{t('coaching.noEvaluationsAvailable')}</h3>
              <p className="text-gray-600">
                {selectedEmployee 
                  ? t('coaching.noEvaluationsForCoachee')
                  : t('coaching.noEvaluationsForAnyCoachee')
                }
              </p>
              {selectedEmployee && (
                <button
                  onClick={() => setSelectedEmployee('')}
                  className="mt-4 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors"
                >
                  {t('coaching.viewAllCoachees')}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Onglet Objectifs annuels */}
      {activeTab === 'objectives' && (
        <div className="space-y-4">
          {filteredObjectives.length > 0 ? (
            filteredObjectives.map((objective) => {
              const isExpanded = expandedObjectives.has(objective.id);
              const isPending = objective.status === 'submitted';
              const isApproved = objective.status === 'approved';
              const isRejected = objective.status === 'rejected';
              
              return (
                <div key={objective.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                  <div className="p-6">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-indigo-600" />
                            <h3 className="text-lg font-semibold text-gray-900">
                              Objectifs {objective.year}
                            </h3>
                          </div>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(objective.status)}`}>
                            {getStatusLabel(objective.status)}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <User className="w-4 h-4" />
                            <span>{objective.employee.full_name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                              objective.career_level ? 
                                `bg-${objective.career_level.color}-100 text-${objective.career_level.color}-800` : 
                                'bg-gray-100 text-gray-800'
                            }`}>
                              {objective.career_level?.name || 'Niveau non défini'}
                            </span>
                          </div>
                        </div>

                        <div className="mt-2">
                          <div className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium border ${
                            objective.career_pathway ? 
                              `bg-${objective.career_pathway.color}-50 text-${objective.career_pathway.color}-700 border-${objective.career_pathway.color}-200` : 
                              'bg-gray-50 text-gray-700 border-gray-200'
                          }`}>
                            <BookOpen className="w-4 h-4 mr-2" />
                            {objective.career_pathway?.name || 'Parcours non défini'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleObjectiveExpansion(objective.id)}
                          className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100"
                        >
                          {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    {/* Boutons d'action pour les objectifs en attente */}
                    {isPending && (
                      <div className="mb-4 flex gap-2 justify-end">
                        <button
                          onClick={() => handleApproveObjective(objective)}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 transition-colors"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Approuver
                        </button>
                        <button
                          onClick={() => handleRejectObjective(objective)}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 transition-colors"
                        >
                          <X className="w-4 h-4" />
                          Rejeter
                        </button>
                      </div>
                    )}

                    {/* Message de statut */}
                    {isApproved && (
                      <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <p className="text-sm text-green-700">
                            Vous avez approuvé ces objectifs. L'employé peut maintenant les utiliser pour son développement.
                          </p>
                        </div>
                      </div>
                    )}

                    {isRejected && (
                      <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-red-600" />
                          <p className="text-sm text-red-700">
                            Vous avez rejeté ces objectifs. L'employé doit les réviser et les soumettre à nouveau.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Résumé des objectifs */}
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">
                          {objective.objectives.length} objectifs
                        </span>
                      </div>
                    </div>

                    {/* Détails des objectifs */}
                    {isExpanded && (
                      <div className="border-t pt-4 space-y-4">
                        {objective.objectives.map((obj: any, index: number) => (
                          <div 
                            key={index} 
                            className={`bg-gray-50 rounded-lg p-4 border ${
                              obj.is_custom 
                                ? obj.objective_type === 'formation' 
                                  ? 'border-orange-200' 
                                  : obj.objective_type === 'custom' 
                                    ? 'border-indigo-200' 
                                    : 'border-purple-200' 
                                : 'border-blue-200'
                            }`}
                          >
                            <div className="mb-2">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-xs px-2 py-1 rounded ${
                                  obj.is_custom 
                                    ? obj.objective_type === 'formation' 
                                      ? 'bg-orange-100 text-orange-700' 
                                      : obj.objective_type === 'custom' 
                                        ? 'bg-indigo-100 text-indigo-700' 
                                        : 'bg-purple-100 text-purple-700' 
                                    : 'bg-gray-200 text-gray-700'
                                }`}>
                                  {obj.theme_name || `Thème ${index + 1}`}
                                </span>
                                {obj.is_custom && (
                                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                                    Personnalisé
                                  </span>
                                )}
                                {obj.is_custom && obj.objective_type && (
                                  <span className={`text-xs px-2 py-1 rounded ${
                                    obj.objective_type === 'smart' ? 'bg-green-100 text-green-800' : 
                                    obj.objective_type === 'formation' ? 'bg-orange-100 text-orange-800' : 
                                    'bg-indigo-100 text-indigo-800'
                                  }`}>
                                    {obj.objective_type === 'smart' ? 'SMART' : 
                                     obj.objective_type === 'formation' ? 'Formation' : 
                                     'Personnalisé'}
                                  </span>
                                )}
                              </div>
                              <h4 className="font-medium text-gray-900">
                                {index + 1}. {obj.skill_description}
                              </h4>
                            </div>
                            <p className="text-sm text-gray-700 mb-3">
                              <strong>Objectif:</strong> {obj.smart_objective}
                            </p>
                            {(obj.is_custom && obj.objective_type === 'smart') || !obj.is_custom ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                <div>
                                  <strong className="text-gray-600">Spécifique:</strong>
                                  <p className="text-gray-700 mt-1">{obj.specific}</p>
                                </div>
                                <div>
                                  <strong className="text-gray-600">Mesurable:</strong>
                                  <p className="text-gray-700 mt-1">{obj.measurable}</p>
                                </div>
                                <div>
                                  <strong className="text-gray-600">Atteignable:</strong>
                                  <p className="text-gray-700 mt-1">{obj.achievable}</p>
                                </div>
                                <div>
                                  <strong className="text-gray-600">Pertinent:</strong>
                                  <p className="text-gray-700 mt-1">{obj.relevant}</p>
                                </div>
                                <div className="md:col-span-2">
                                  <strong className="text-gray-600">Temporel:</strong>
                                  <p className="text-gray-700 mt-1">{obj.time_bound}</p>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex justify-between items-center text-xs text-gray-500 mt-4 pt-4 border-t">
                      <span>
                        Créé le {format(new Date(objective.created_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                      </span>
                      {objective.updated_at !== objective.created_at && (
                        <span>
                          Modifié le {format(new Date(objective.updated_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 bg-white rounded-lg shadow-sm border">
              <Target className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun objectif annuel</h3>
              <p className="text-gray-600">
                {selectedEmployee 
                  ? "Ce coaché n'a pas encore défini d'objectifs annuels."
                  : "Aucun de vos coachés n'a encore défini d'objectifs annuels."
                }
              </p>
              {selectedEmployee && (
                <button
                  onClick={() => setSelectedEmployee('')}
                  className="mt-4 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors"
                >
                  Voir tous les coachés
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Onglet Évaluations annuelles */}
      {activeTab === 'annual_evaluations' && (
        <div className="space-y-4">
          {filteredAnnualEvaluations.length > 0 ? (
            filteredAnnualEvaluations.map((evaluation) => {
              const isExpanded = expandedAnnualEvaluations.has(evaluation.id);
              const objective = evaluation.annual_objective;

              return (
                <div key={evaluation.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                  <div className="p-6">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Calendar className="w-5 h-5 text-indigo-600" />
                          <h3 className="text-lg font-semibold text-gray-900">
                            Évaluation annuelle {evaluation.year}
                          </h3>
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            En attente d'évaluation coach
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <User className="w-4 h-4" />
                            <span>{objective.employee.full_name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-yellow-400" />
                            <span>Note globale employé: {evaluation.employee_global_score}/5</span>
                          </div>
                        </div>

                        <div className="mt-2">
                          <div className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium border bg-gray-50 text-gray-700 border-gray-200">
                            <BookOpen className="w-4 h-4 mr-2" />
                            {objective.career_pathway?.name || 'Parcours non défini'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleStartCoachEvaluation(evaluation)}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                          Évaluer
                        </button>
                        <button
                          onClick={() => toggleAnnualEvaluationExpansion(evaluation.id)}
                          className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100"
                        >
                          {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    {/* Commentaire global de l'employé */}
                    <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <h4 className="text-sm font-medium text-blue-800 mb-2">Commentaire global de l'employé</h4>
                      <p className="text-sm text-blue-700">{evaluation.employee_global_comment}</p>
                    </div>

                    {/* Détails des évaluations par objectif */}
                    {isExpanded && (
                      <div className="border-t pt-4 space-y-4">
                        <h4 className="font-medium text-gray-900 mb-3">
                          Évaluations détaillées ({evaluation.evaluations.length} objectifs)
                        </h4>
                        {evaluation.evaluations.map((evalItem: any, index: number) => {
                          const objectiveDetail = objective.objectives[index];

                          return (
                            <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                              <div className="mb-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
                                    {objectiveDetail?.theme_name || 'Thème non défini'}
                                  </span>
                                </div>
                                <h5 className="font-medium text-gray-900">
                                  {index + 1}. {evalItem.skill_description}
                                </h5>
                              </div>

                              <div className="bg-blue-50 rounded p-3">
                                <h6 className="text-sm font-medium text-blue-800 mb-2">Auto-évaluation</h6>
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="flex">
                                    {getScoreStars(evalItem.employee_score)}
                                  </div>
                                  <span className="text-sm text-blue-700">({evalItem.employee_score}/5)</span>
                                </div>
                                <p className="text-sm text-blue-700 mb-2">
                                  <strong>Commentaire:</strong> {evalItem.employee_comment}
                                </p>
                                <p className="text-sm text-blue-700 mb-1">
                                  <strong>Réalisations:</strong> {evalItem.achievements}
                                </p>
                                {evalItem.difficulties && (
                                  <p className="text-sm text-blue-700 mb-1">
                                    <strong>Difficultés:</strong> {evalItem.difficulties}
                                  </p>
                                )}
                                <p className="text-sm text-blue-700 mb-1">
                                  <strong>Apprentissages:</strong> {evalItem.learnings}
                                </p>
                                {evalItem.next_steps && (
                                  <p className="text-sm text-blue-700">
                                    <strong>Prochaines étapes:</strong> {evalItem.next_steps}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex justify-between items-center text-xs text-gray-500 mt-4 pt-4 border-t">
                      <span>
                        Soumis le {format(new Date(evaluation.submitted_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 bg-white rounded-lg shadow-sm border">
              <Award className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune évaluation annuelle en attente</h3>
              <p className="text-gray-600">
                {selectedEmployee
                  ? "Ce coaché n'a pas encore soumis d'évaluation annuelle."
                  : "Aucun de vos coachés n'a encore soumis d'évaluation annuelle."}
              </p>
              {selectedEmployee && (
                <button
                  onClick={() => setSelectedEmployee('')}
                  className="mt-4 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors"
                >
                  Voir tous les coachés
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal d'évaluation coach */}
      {showCoachEvaluationModal && selectedEvaluationForCoach && (
        <AnnualEvaluationCoachModal
          objective={selectedEvaluationForCoach.objective}
          employeeEvaluation={selectedEvaluationForCoach.employeeEvaluation}
          onClose={() => {
            setShowCoachEvaluationModal(false);
            setSelectedEvaluationForCoach(null);
          }}
          onSuccess={handleCoachEvaluationCompleted}
          onError={(error) => {
            setError(error);
            setTimeout(() => setError(null), 5000);
          }}
        />
      )}
    </div>
  );
};

export default MonCoaching;