import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Bell, CheckCircle, AlertTriangle, Users, Star, Calendar, Target, Briefcase, Flag, Mail, Phone, Building, Award } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

interface UserProfile {
  full_name: string | null;
  role: string | null;
  department: string | null;
  manager_id: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  date_entree_entreprise: string | null;
  fiche_poste: string | null;
  career_level_id: string | null;
  career_pathway_id: string | null;
}

interface ManagerProfile {
  full_name: string;
}

interface CareerLevel {
  name: string;
  color: string;
}

interface CareerPathway {
  name: string;
  color: string;
}

interface CoachProjectChecks {
  coacheesCount: number;
  missingProjectAssignments: { id: string; full_name: string }[];
  missingProjectObjectives: {
    employee_id: string;
    full_name: string;
    project_id: string;
    project_title: string;
    project_client: string | null;
  }[];
}

const Dashboard = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [manager, setManager] = useState<ManagerProfile | null>(null);
  const [careerLevel, setCareerLevel] = useState<CareerLevel | null>(null);
  const [careerPathway, setCareerPathway] = useState<CareerPathway | null>(null);
  const [annualEvaluationsToDo, setAnnualEvaluationsToDo] = useState(0);
  const [projectEvaluationsToDo, setProjectEvaluationsToDo] = useState(0);
  const [isCoach, setIsCoach] = useState(false);
  const [coachChecks, setCoachChecks] = useState<CoachProjectChecks | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { userCountry } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get the authenticated user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          throw new Error(`Authentication error: ${userError.message}`);
        }

        if (!user) {
          throw new Error('No authenticated user found');
        }

        // Query for the user's profile with all needed information
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select(`
            full_name, 
            role, 
            department, 
            manager_id, 
            country,
            email,
            phone,
            date_entree_entreprise,
            fiche_poste,
            career_level_id,
            career_pathway_id
          `)
          .eq('id', user.id)
          .limit(1);

        if (profileError) {
          throw new Error(`Profile fetch error: ${profileError.message}`);
        }

        // If no profile exists or profile is incomplete, redirect to complete profile page
        if (!profileData || profileData.length === 0) {
          navigate('/complete-profile');
          return;
        }

        const userProfile = profileData[0];
        
        // Check if profile is complete (full_name should not be the email)
        if (!userProfile.full_name || 
            !userProfile.role || 
            userProfile.full_name === user.email) {
          navigate('/complete-profile');
          return;
        }

        setProfile(userProfile);

        // Fetch manager details separately if manager_id exists
        if (userProfile.manager_id) {
          const { data: managerData, error: managerError } = await supabase
            .from('user_profiles')
            .select('full_name')
            .eq('id', userProfile.manager_id)
            .limit(1);

          if (!managerError && managerData && managerData.length > 0) {
            setManager(managerData[0]);
          }
        }

        // Fetch career level if exists
        if (userProfile.career_level_id) {
          const { data: levelData, error: levelError } = await supabase
            .from('career_levels')
            .select('name, color')
            .eq('id', userProfile.career_level_id)
            .limit(1);

          if (!levelError && levelData && levelData.length > 0) {
            setCareerLevel(levelData[0]);
          }
        }

        // Fetch career pathway if exists
        if (userProfile.career_pathway_id) {
          const { data: pathwayData, error: pathwayError } = await supabase
            .from('career_areas')
            .select('name, color')
            .eq('id', userProfile.career_pathway_id)
            .limit(1);

          if (!pathwayError && pathwayData && pathwayData.length > 0) {
            setCareerPathway(pathwayData[0]);
          }
        }

        await Promise.all([
          fetchEvaluationNotifications(user.id),
          fetchCoachChecks(user.id)
        ]);

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
        setError(errorMessage);
        console.error('Error in Dashboard:', errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  const getRoleDisplayName = (role: string) => {
    const roleMap = {
      'employe': t('administration.currentRole.employee'),
      'admin': t('administration.currentRole.admin')
    };
    return roleMap[role as keyof typeof roleMap] || role;
  };

  const getWelcomeMessage = (role: string) => {
    const hour = new Date().getHours();
    let timeGreeting = '';
    
    if (hour < 12) {
      timeGreeting = t('dashboard.goodMorning');
    } else if (hour < 18) {
      timeGreeting = t('dashboard.goodAfternoon');
    } else {
      timeGreeting = t('dashboard.goodEvening');
    }

    const roleMessages = {
      'employe': t('dashboard.employeeMessage'),
      'admin': t('dashboard.adminMessage')
    };

    return {
      greeting: timeGreeting,
      message: roleMessages[role as keyof typeof roleMessages] || t('dashboard.welcome')
    };
  };

  const getCountryFlag = (country: string | null) => {
    switch (country) {
      case 'france':
        return '🇫🇷 ' + t('common.france');
      case 'espagne':
        return '🇪🇸 ' + t('common.spain');
      default:
        return '🇫🇷 ' + t('common.france');
    }
  };

  const getCareerLevelBadge = (level: CareerLevel) => {
    const colorMap: Record<string, string> = {
      'green': 'bg-green-100 text-green-800',
      'blue': 'bg-blue-100 text-blue-800',
      'purple': 'bg-purple-100 text-purple-800',
      'orange': 'bg-orange-100 text-orange-800',
      'red': 'bg-red-100 text-red-800',
      'indigo': 'bg-indigo-100 text-indigo-800',
      'gray': 'bg-gray-100 text-gray-800'
    };
    return colorMap[level.color] || 'bg-gray-100 text-gray-800';
  };

  const getCareerPathwayBadge = (pathway: CareerPathway) => {
    const colorMap: Record<string, string> = {
      'green': 'bg-green-50 text-green-700 border-green-200',
      'blue': 'bg-blue-50 text-blue-700 border-blue-200',
      'purple': 'bg-purple-50 text-purple-700 border-purple-200',
      'orange': 'bg-orange-50 text-orange-700 border-orange-200',
      'red': 'bg-red-50 text-red-700 border-red-200',
      'indigo': 'bg-indigo-50 text-indigo-700 border-indigo-200',
      'gray': 'bg-gray-50 text-gray-700 border-gray-200'
    };
    return colorMap[pathway.color] || 'bg-gray-50 text-gray-700 border-gray-200';
  };

  const formatLimitedList = (items: string[], maxItems = 5) => {
    if (items.length <= maxItems) {
      return items.join(', ');
    }
    return `${items.slice(0, maxItems).join(', ')} +${items.length - maxItems} autres`;
  };

  const fetchEvaluationNotifications = async (userId: string) => {
    try {
      const { data, error: notificationsError } = await supabase
        .from('notifications')
        .select('metadata, is_archived')
        .eq('destinataire_id', userId)
        .eq('is_archived', false);

      if (notificationsError) throw notificationsError;

      const notifications = data || [];
      const annualCount = notifications.filter(notif => notif.metadata?.action_type === 'annual_evaluation_required').length;
      const projectCount = notifications.filter(notif => notif.metadata?.action_type === 'auto_evaluation_required').length;

      setAnnualEvaluationsToDo(annualCount);
      setProjectEvaluationsToDo(projectCount);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setAnnualEvaluationsToDo(0);
      setProjectEvaluationsToDo(0);
    }
  };

  const fetchCoachChecks = async (userId: string) => {
    try {
      const { data: coachees, error: coacheesError } = await supabase
        .from('user_profiles')
        .select('id, full_name')
        .eq('coach_id', userId);

      if (coacheesError) throw coacheesError;

      if (!coachees || coachees.length === 0) {
        setIsCoach(false);
        setCoachChecks(null);
        return;
      }

      setIsCoach(true);
      const coacheeIds = coachees.map(coachee => coachee.id);

      const { data: collaborations, error: collaborationsError } = await supabase
        .from('projet_collaborateurs')
        .select(`
          id,
          employe_id,
          is_active,
          projet:projets(
            id,
            titre,
            nom_client
          )
        `)
        .in('employe_id', coacheeIds)
        .eq('is_active', true);

      if (collaborationsError) throw collaborationsError;

      const activeCollaborations = collaborations || [];
      const collaborationIds = activeCollaborations.map(collab => collab.id);

      const objectifsByCollab = new Map<string, any[]>();
      if (collaborationIds.length > 0) {
        const { data: objectifsData, error: objectifsError } = await supabase
          .from('objectifs_collaborateurs')
          .select('collaboration_id, objectifs')
          .in('collaboration_id', collaborationIds);

        if (objectifsError) throw objectifsError;

        (objectifsData || []).forEach(item => {
          objectifsByCollab.set(item.collaboration_id, item.objectifs || []);
        });
      }

      const coacheesWithProjects = new Set(activeCollaborations.map(collab => collab.employe_id));
      const missingProjectAssignments = coachees.filter(coachee => !coacheesWithProjects.has(coachee.id));

      const missingProjectObjectives: CoachProjectChecks['missingProjectObjectives'] = [];
      activeCollaborations.forEach(collab => {
        const objectifs = objectifsByCollab.get(collab.id);
        if (!objectifs || objectifs.length === 0) {
          const coachee = coachees.find(item => item.id === collab.employe_id);
          missingProjectObjectives.push({
            employee_id: collab.employe_id,
            full_name: coachee?.full_name || 'Collaborateur',
            project_id: collab.projet?.id || '',
            project_title: collab.projet?.titre || 'Projet',
            project_client: collab.projet?.nom_client || null
          });
        }
      });

      setCoachChecks({
        coacheesCount: coachees.length,
        missingProjectAssignments,
        missingProjectObjectives
      });
    } catch (err) {
      console.error('Error checking coach projects:', err);
      setIsCoach(false);
      setCoachChecks(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">
          <AlertTriangle className="mx-auto h-8 w-8 mb-2" />
          <p className="font-medium">{t('common.error')}</p>
          <p className="text-sm mt-1">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 rounded-md transition-colors text-sm"
          >
            {t('common.retry')}
          </button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  const welcomeMsg = getWelcomeMessage(profile.role || '');
  const hasAnnualEvaluationsToDo = annualEvaluationsToDo > 0;
  const hasProjectEvaluationsToDo = projectEvaluationsToDo > 0;
  const missingAssignments = coachChecks?.missingProjectAssignments || [];
  const missingObjectives = coachChecks?.missingProjectObjectives || [];

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl shadow-lg text-white">
        <div className="p-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">
                {welcomeMsg.greeting}, {profile.full_name?.split(' ')[0] || t('common.user')} !
              </h1>
              <p className="text-indigo-100 text-lg mb-4">
                {welcomeMsg.message}
              </p>
            </div>
            <div className="hidden md:block">
              <div className="w-24 h-24 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <Users className="w-12 h-12 text-white" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* User Profile Card */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-800">{t('common.profile')}</h2>
        </div>
        
        <div className="p-6">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Avatar and basic info */}
            <div className="flex flex-col items-center md:items-start">
              <div className="w-32 h-32 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                <Users className="w-16 h-16 text-indigo-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">{profile.full_name}</h3>
              <p className="text-gray-600 mb-2">{getRoleDisplayName(profile.role || '')}</p>
              
              {profile.fiche_poste && (
                <div className="flex items-center gap-2 text-gray-600 mt-1">
                  <Briefcase className="w-4 h-4" />
                  <span>{profile.fiche_poste}</span>
                </div>
              )}
              
              <div className="flex items-center gap-2 text-gray-600 mt-1">
                <Flag className="w-4 h-4" />
                <span>{getCountryFlag(profile.country)}</span>
              </div>
            </div>
            
            {/* Contact and details */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Contact Information */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-800 border-b pb-2">{t('settings.personalInfo')}</h4>
                
                {profile.email && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Mail className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('auth.email')}</p>
                      <p className="font-medium">{profile.email}</p>
                    </div>
                  </div>
                )}
                
                {profile.phone && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Phone className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('common.phone')}</p>
                      <p className="font-medium">{profile.phone}</p>
                    </div>
                  </div>
                )}
                
                {profile.date_entree_entreprise && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <Calendar className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('profile.joinDate')}</p>
                      <p className="font-medium">
                        {format(new Date(profile.date_entree_entreprise), 'dd/MM/yyyy', { locale: fr })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Career Information */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-800 border-b pb-2">{t('profile.careerInfo')}</h4>
                
                {manager && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                      <Users className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('administration.manager')}</p>
                      <p className="font-medium">{manager.full_name}</p>
                    </div>
                  </div>
                )}
                
                {careerLevel && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <Target className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('annualObjectives.careerLevel')}</p>
                      <div className="mt-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCareerLevelBadge(careerLevel)}`}>
                          {careerLevel.name}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                
                {careerPathway && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-teal-100 rounded-lg">
                      <Award className="w-5 h-5 text-teal-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('annualObjectives.careerPathway')}</p>
                      <div className="mt-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getCareerPathwayBadge(careerPathway)}`}>
                          {careerPathway.name}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* To-do section */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">À faire</h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className={`flex items-start gap-4 p-4 rounded-lg border ${hasAnnualEvaluationsToDo ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
            {hasAnnualEvaluationsToDo ? (
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            ) : (
              <CheckCircle className="w-6 h-6 text-green-600" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700">Évaluations annuelles à réaliser</p>
              <p className={`text-lg font-semibold ${hasAnnualEvaluationsToDo ? 'text-orange-700' : 'text-green-700'}`}>
                {hasAnnualEvaluationsToDo ? `${annualEvaluationsToDo} en attente` : 'Aucune en attente'}
              </p>
              {hasAnnualEvaluationsToDo && (
                <button
                  onClick={() => navigate('/objectifs-annuels')}
                  className="mt-2 text-sm text-orange-700 hover:text-orange-800 underline"
                >
                  Voir les évaluations annuelles
                </button>
              )}
            </div>
          </div>

          <div className={`flex items-start gap-4 p-4 rounded-lg border ${hasProjectEvaluationsToDo ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
            {hasProjectEvaluationsToDo ? (
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            ) : (
              <CheckCircle className="w-6 h-6 text-green-600" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700">Évaluations projets à réaliser</p>
              <p className={`text-lg font-semibold ${hasProjectEvaluationsToDo ? 'text-orange-700' : 'text-green-700'}`}>
                {hasProjectEvaluationsToDo ? `${projectEvaluationsToDo} en attente` : 'Aucune en attente'}
              </p>
              {hasProjectEvaluationsToDo && (
                <button
                  onClick={() => navigate('/fiches-projets')}
                  className="mt-2 text-sm text-orange-700 hover:text-orange-800 underline"
                >
                  Voir les évaluations projets
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Coaching checks */}
      {isCoach && coachChecks && (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Suivi des coachés</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className={`flex items-start gap-4 p-4 rounded-lg border ${missingAssignments.length > 0 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
              {missingAssignments.length > 0 ? (
                <AlertTriangle className="w-6 h-6 text-orange-600" />
              ) : (
                <CheckCircle className="w-6 h-6 text-green-600" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700">Coachés sans projet assigné</p>
                <p className={`text-lg font-semibold ${missingAssignments.length > 0 ? 'text-orange-700' : 'text-green-700'}`}>
                  {missingAssignments.length > 0
                    ? `${missingAssignments.length} à assigner`
                    : 'Tous assignés à un projet'}
                </p>
                {missingAssignments.length > 0 && (
                  <p className="text-sm text-orange-700 mt-1">
                    {formatLimitedList(missingAssignments.map(item => item.full_name))}
                  </p>
                )}
              </div>
            </div>

            <div className={`flex items-start gap-4 p-4 rounded-lg border ${missingObjectives.length > 0 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
              {missingObjectives.length > 0 ? (
                <AlertTriangle className="w-6 h-6 text-orange-600" />
              ) : (
                <CheckCircle className="w-6 h-6 text-green-600" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700">Objectifs projets à définir</p>
                <p className={`text-lg font-semibold ${missingObjectives.length > 0 ? 'text-orange-700' : 'text-green-700'}`}>
                  {missingObjectives.length > 0
                    ? `${missingObjectives.length} projet(s) incomplet(s)`
                    : 'Tous les objectifs projets sont définis'}
                </p>
                {missingObjectives.length > 0 && (
                  <p className="text-sm text-orange-700 mt-1">
                    {formatLimitedList(
                      missingObjectives.map(item =>
                        `${item.full_name} — ${item.project_title}${item.project_client ? ` (${item.project_client})` : ''}`
                      )
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">{t('dashboard.recentActivity')}</h2>
        </div>
        <div className="p-6">
          <div className="text-center py-8">
            <Bell className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('dashboard.noRecentActivity')}</h3>
            <p className="text-gray-600">
              {t('dashboard.activityWillAppear')}
            </p>
          </div>
        </div>
      </div>

      {/* Welcome Message for First Time Users */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start">
          <CheckCircle className="h-6 w-6 text-blue-600 mt-1 mr-3 flex-shrink-0" />
          <div>
            <h3 className="text-lg font-medium text-blue-900 mb-2">
              {t('dashboard.welcomeMessage')}
            </h3>
            <p className="text-blue-800 mb-4">
              {t('dashboard.profileConfigured')}
            </p>
            <ul className="text-blue-800 space-y-2">
              <li className="flex items-center">
                <CheckCircle className="h-4 w-4 text-blue-600 mr-2" />
                {t('dashboard.createManageObjectives')}
              </li>
              <li className="flex items-center">
                <CheckCircle className="h-4 w-4 text-blue-600 mr-2" />
                {t('dashboard.consultProjects')}
              </li>
              <li className="flex items-center">
                <CheckCircle className="h-4 w-4 text-blue-600 mr-2" />
                {t('dashboard.trackAnnualObjectives')}
              </li>
              <li className="flex items-center">
                <CheckCircle className="h-4 w-4 text-blue-600 mr-2" />
                {t('dashboard.modifyAccountSettings')}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;