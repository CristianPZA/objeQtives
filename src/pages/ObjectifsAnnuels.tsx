import React, { useState, useEffect } from 'react';
import { Plus, Target, Calendar, User, BookOpen, CheckCircle, Clock, AlertCircle, Edit, Trash2, Star } from 'lucide-react';
import { supabase } from '../lib/supabase';
import CreateObjectiveModal from '../components/objectives/CreateObjectiveModal';
import ObjectiveCard from '../components/objectives/ObjectiveCard';
import { useTranslation } from 'react-i18next';
import AnnualEvaluationModal from '../components/objectives/AnnualEvaluationModal';

interface AnnualObjective {
  id: string;
  employee_id: string;
  year: number;
  career_pathway_id: string;
  career_level_id: string;
  selected_themes: string[];
  objectives: ObjectiveDetail[];
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
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

interface ObjectiveDetail {
  skill_id: string;
  skill_description: string;
  theme_name: string;
  smart_objective: string;
  specific: string;
  measurable: string;
  achievable: string;
  relevant: string;
  time_bound: string;
  is_custom?: boolean;
  objective_type?: string; // Type d'objectif personnalisé
}

interface Notification {
  id: string;
  destinataire_id: string;
  expediteur_id: string;
  titre: string;
  message: string;
  type: string;
  priority: number;
  is_read: boolean;
  is_archived: boolean;
  action_url: string;
  metadata: any;
  created_at: string;
}

const ObjectifsAnnuels = () => {
  const { t } = useTranslation();
  const [objectives, setObjectives] = useState<AnnualObjective[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEvaluationModal, setShowEvaluationModal] = useState(false);
  const [selectedObjective, setSelectedObjective] = useState<AnnualObjective | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [evaluationNotifications, setEvaluationNotifications] = useState<Notification[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  const currentYear = new Date().getFullYear();
  const currentYearObjective = objectives.find(obj => obj.year === currentYear && obj.employee_id === currentUser?.id);

  useEffect(() => {
    checkUserAndFetchObjectives();
  }, []);

  const checkUserAndFetchObjectives = async () => {
    try {
      setLoading(true);
      
      // Récupérer l'utilisateur actuel
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t('common.notLoggedIn'));

      // Récupérer le profil utilisateur
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!profile) throw new Error(t('common.profileNotFound'));

      const isUserAdmin = profile.role === 'admin';
      setIsAdmin(isUserAdmin);
      setCurrentUser(profile);
      setUserRole(profile.role);

      await fetchObjectives(user.id, isUserAdmin);
      await fetchEvaluationNotifications(user.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.loadingError'));
    } finally {
      setLoading(false);
    }
  };

  const fetchObjectives = async (userId: string, isAdmin: boolean) => {
    try {
      // Check network connectivity first
      if (!navigator.onLine) {
        throw new Error(t('common.networkError'));
      }

      let query = supabase
        .from('annual_objectives')
        .select(`
          *,
          employee:user_profiles!employee_id(full_name, role),
          career_pathway:career_areas!career_pathway_id(name, color),
          career_level:career_levels!career_level_id(name, color)
        `);
      
      // Si l'utilisateur n'est pas admin, ne montrer que ses propres objectifs
      if (!isAdmin) {
        query = query.eq('employee_id', userId);
      }
      
      // Trier par date de création (plus récent en premier)
      query = query.order('created_at', { ascending: false });
      
      const { data, error } = await query;

      if (error) throw error;
      setObjectives(data || []);
    } catch (err) {
      console.error('Error fetching objectives:', err);
      
      // Handle different types of errors
      if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
        setError(t('common.connectionError'));
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t('annualObjectives.errorFetchingObjectives'));
      }
    }
  };

  const fetchEvaluationNotifications = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('destinataire_id', userId)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filtrer les notifications liées aux auto-évaluations annuelles
      const evaluationNotifs = (data || []).filter(notif => 
        notif.metadata?.action_type === 'annual_evaluation_required'
      );

      setEvaluationNotifications(evaluationNotifs);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  const handleCreateObjective = () => {
    // Si un objectif existe déjà pour l'année courante, on l'édite
    if (currentYearObjective) {
      setSelectedObjective(currentYearObjective);
    }
    setShowCreateModal(true);
  };

  const handleObjectiveCreated = () => {
    setShowCreateModal(false);
    setSelectedObjective(null);
    fetchObjectives(currentUser.id, userRole || '');
    setSuccess(t('annualObjectives.objectivesCreatedSuccess'));
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleObjectiveUpdated = () => {
    fetchObjectives(currentUser.id, isAdmin);
    setSuccess(t('annualObjectives.objectivesUpdatedSuccess'));
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleDeleteObjective = async (objectiveId: string) => {
    // Vérifier si l'utilisateur est admin
    if (!isAdmin) {
      setError(t('common.permissionDenied'));
      setTimeout(() => setError(null), 5000);
      return;
    }
    
    if (!confirm(t('annualObjectives.confirmDelete'))) {
      return;
    }

    try {
      const { error } = await supabase
        .from('annual_objectives')
        .delete()
        .eq('id', objectiveId);

      if (error) throw error;

      setSuccess(t('annualObjectives.objectivesDeletedSuccess'));
      fetchObjectives(currentUser.id, userRole || '');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.deletionError'));
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleStartEvaluation = (objective: AnnualObjective) => {
    // Si l'utilisateur est admin, rediriger vers la page de modification
    if (isAdmin) {
      // Pour les admins, on utilise le modal de création pour éditer
      setSelectedObjective(objective);
      setShowCreateModal(true);
      return;
    }
    
    // Pour les employés, on utilise le modal d'évaluation
    setSelectedObjective(objective);
    setShowEvaluationModal(true);
  };

  const handleEvaluationCompleted = () => {
    setShowEvaluationModal(false);
    setSelectedObjective(null);
    setSuccess('Auto-évaluation soumise avec succès');
    
    // Rafraîchir les notifications et les objectifs
    if (currentUser) {
      fetchEvaluationNotifications(currentUser.id);
      fetchObjectives(currentUser.id, userRole || '');
    }
    
    setTimeout(() => setSuccess(null), 3000);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'submitted':
        return <Clock className="w-4 h-4 text-gray-500" />;
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'waiting auto evaluation':
        return <AlertCircle className="w-4 h-4 text-blue-500" />;
      case 'evaluated':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'submitted':
        return t('annualObjectives.objectiveStatuses.submitted');
      case 'approved':
        return t('annualObjectives.objectiveStatuses.approved');
      case 'waiting auto evaluation':
        return t('annualObjectives.objectiveStatuses.waitingAutoEvaluation');
      case 'evaluated':
        return t('annualObjectives.objectiveStatuses.evaluated');
      default:
        return t('common.unknown');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted':
        return 'bg-gray-100 text-gray-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'waiting auto evaluation':
        return 'bg-blue-100 text-blue-800';
      case 'evaluated':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const canCreateObjectives = () => {
    return currentUser && currentUser.career_pathway_id && currentUser.career_level_id;
  };

  const hasEvaluationNotification = (objective: AnnualObjective) => {
    return evaluationNotifications.some(notif => 
      notif.metadata?.year === objective.year
    );
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
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('annualObjectives.title')}</h1>
          <p className="text-gray-600 mt-1">{t('annualObjectives.subtitle')}</p>
        </div>
        {canCreateObjectives() && (
          <button
            onClick={handleCreateObjective}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus className="w-5 h-5" />
            {currentYearObjective ? t('annualObjectives.editCurrentYearObjectives') : t('annualObjectives.createAnnualObjectives')}
          </button>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 text-green-700 p-4 rounded-lg">
          {success}
        </div>
      )}

      {/* Notifications d'auto-évaluation */}
      {evaluationNotifications.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Star className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-orange-800">Auto-évaluation annuelle requise</h3>
              <p className="text-sm text-orange-700 mt-1">
                Vous avez {evaluationNotifications.length} auto-évaluation{evaluationNotifications.length > 1 ? 's' : ''} à compléter. 
                Utilisez le bouton "Commencer l'auto-évaluation" sur vos objectifs annuels.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info pour les utilisateurs sans career pathway */}
      {!canCreateObjectives() && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800">{t('annualObjectives.configurationRequired')}</h3>
              <p className="text-sm text-yellow-700 mt-1">
                {t('annualObjectives.configurationMessage')}
              </p>
              <div className="mt-2 text-xs text-yellow-600">
                <p>• {t('annualObjectives.careerPathway')}: {currentUser?.career_pathway_id ? t('annualObjectives.configured') : t('annualObjectives.notConfigured')}</p>
                <p>• {t('annualObjectives.careerLevel')}: {currentUser?.career_level_id ? t('annualObjectives.configured') : t('annualObjectives.notConfigured')}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Target className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">{t('annualObjectives.totalObjectives')}</p>
              <p className="text-2xl font-bold text-gray-900">{objectives.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">{t('annualObjectives.approved')}</p>
              <p className="text-2xl font-bold text-gray-900">
                {objectives.filter(obj => obj.status === 'approved').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Brouillons</p>
              <p className="text-2xl font-bold text-gray-900">
                {objectives.filter(obj => obj.status === 'draft').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Calendar className="w-5 h-5 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">{t('annualObjectives.currentYear')} {currentYear}</p>
              <p className="text-2xl font-bold text-gray-900">
                {objectives.filter(obj => obj.year === currentYear).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Liste des objectifs */}
      <div className="space-y-4">
        {objectives.length > 0 ? (
          objectives.map((objective) => (
            <ObjectiveCard
              key={objective.id}
              objective={objective}
              onDelete={handleDeleteObjective}
              currentUserId={currentUser?.id || ''}
              userRole={userRole}
              onStartEvaluation={isAdmin || hasEvaluationNotification(objective) ? handleStartEvaluation : undefined}
              onSuccess={handleObjectiveUpdated}
            />
          ))
        ) : (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm border">
            <Target className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('annualObjectives.noObjectivesDefined')}</h3>
            <p className="text-gray-600 mb-4">
              {t('annualObjectives.startByCreating')}
            </p>
            {canCreateObjectives() && (
              <button
                onClick={handleCreateObjective}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 mx-auto transition-colors"
              >
                <Plus className="w-4 h-4" />
                {currentYearObjective ? t('annualObjectives.editCurrentYearObjectives') : t('annualObjectives.createFirstObjectives')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal de création */}
      {showCreateModal && currentUser && (
        <CreateObjectiveModal
          user={currentUser}
          selectedObjective={selectedObjective}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleObjectiveCreated}
          onError={(error) => {
            setError(error);
            setTimeout(() => setError(null), 5000);
          }}
        />
      )}

      {/* Modal d'auto-évaluation */}
      {showEvaluationModal && selectedObjective && (
        <AnnualEvaluationModal
          objective={selectedObjective}
          onClose={() => {
            setShowEvaluationModal(false);
            setSelectedObjective(null);
          }}
          onSuccess={handleEvaluationCompleted}
          onError={(error) => {
            setError(error);
            setTimeout(() => setError(null), 5000);
          }}
        />
      )}
    </div>
  );
};

export default ObjectifsAnnuels;