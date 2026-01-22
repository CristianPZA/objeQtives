import React, { useState } from 'react';
import { Calendar, User, BookOpen, Target, Edit, Trash2, Eye, EyeOff, ChevronDown, ChevronRight, Star, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';

interface ObjectiveCardProps {
  objective: any;
  onDelete: (id: string) => void;
  currentUserId: string;
  userRole: string | null;
  onStartEvaluation?: (objective: any) => void;
  onSuccess?: () => void;
  onSuccess?: () => void;
}

const ObjectiveCard: React.FC<ObjectiveCardProps> = ({
  objective,
  onDelete,
  currentUserId,
  userRole,
  onStartEvaluation,
  onSuccess
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [validating, setValidating] = useState(false);

  const canEdit = () => {
    // Seuls les admins peuvent modifier les objectifs
    return userRole === 'admin';
  };

  const canDelete = () => {
    // Seuls les admins peuvent supprimer les objectifs
    return userRole === 'admin' && (objective.status === 'draft' || objective.status === 'submitted');
  };

  const canValidate = () => {
    // Seul le propriétaire des objectifs peut les valider, et seulement s'ils sont en brouillon
    return objective.employee_id === currentUserId && objective.status === 'submitted';
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Empêcher la propagation de l'événement
    if (canEdit() && onStartEvaluation) {
      onStartEvaluation(objective);
    }
  };

  const handleValidateObjectives = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Empêcher la propagation de l'événement
    
    if (!canValidate()) return;
    
    if (!confirm(t('annualObjectives.confirmValidation'))) {
      return;
    }
    
    setValidating(true);
    
    try {
      const { error } = await supabase
        .from('annual_objectives')
        .update({ status: 'approved' })
        .eq('id', objective.id);

      if (error) throw error;
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Error validating objectives:', err);
      alert(t('annualObjectives.validationError'));
    } finally {
      setValidating(false);
    }
  };

  const canEvaluate = () => {
    // Vérifier si l'objectif appartient à l'utilisateur actuel et si la fonction onStartEvaluation est disponible
    // Le bouton s'affiche pour les statuts 'waiting auto evaluation' ou si l'admin veut éditer
    return objective.employee_id === currentUserId &&
           onStartEvaluation !== undefined &&
           (objective.status === 'waiting auto evaluation' || userRole === 'admin');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':
        return '📝';
      case 'submitted':
        return '⏳';
      case 'approved':
        return '✅';
      case 'waiting auto evaluation':
        return '⭐';
      case 'evaluated':
        return '✅';
      case 'rejected':
        return '❌';
      default:
        return '📝';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return t('annualObjectives.objectiveStatuses.draft');
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
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'submitted':
        return 'bg-blue-100 text-blue-800';
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

  const getCareerPathwayColor = (color: string) => {
    const colorMap: Record<string, string> = {
      green: 'bg-green-50 text-green-700 border-green-200',
      blue: 'bg-blue-50 text-blue-700 border-blue-200',
      purple: 'bg-purple-50 text-purple-700 border-purple-200',
      orange: 'bg-orange-50 text-orange-700 border-orange-200',
      red: 'bg-red-50 text-red-700 border-red-200',
      indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      gray: 'bg-gray-50 text-gray-700 border-gray-200'
    };
    return colorMap[color] || 'bg-gray-50 text-gray-700 border-gray-200';
  };

  const getCareerLevelColor = (color: string) => {
    const colorMap: Record<string, string> = {
      green: 'bg-green-100 text-green-800',
      blue: 'bg-blue-100 text-blue-800',
      purple: 'bg-purple-100 text-purple-800',
      orange: 'bg-orange-100 text-orange-800',
      red: 'bg-red-100 text-red-800',
      indigo: 'bg-indigo-100 text-indigo-800',
      gray: 'bg-gray-100 text-gray-800'
    };
    return colorMap[color] || 'bg-gray-100 text-gray-800';
  };

  // Compter les objectifs par type (career pathway vs personnalisé)
  const countObjectivesByType = () => {
    if (!objective.objectives) return { custom: 0, career: 0, formation: 0, simple: 0 };
    
    return objective.objectives.reduce((acc: {custom: number, career: number, formation: number, simple: number}, obj: any) => {
      if (obj.is_custom) {
        if (obj.objective_type === 'formation') {
          acc.formation += 1;
        } else if (obj.objective_type === 'custom') {
          acc.simple += 1;
        } else {
          acc.custom += 1;
        }
      } else {
        acc.career += 1;
      }
      return acc;
    }, { custom: 0, career: 0, formation: 0, simple: 0 });
  };
  
  const objectiveCounts = countObjectivesByType();

  return (
    <div className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-semibold text-gray-900">
                  {t('objectives.objectivesForYear', { year: objective.year })}
                </h3>
              </div>
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(objective.status)}`}>
                {getStatusIcon(objective.status)} {getStatusLabel(objective.status)}
              </span>
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <User className="w-4 h-4" />
                <span>{objective.employee.full_name}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getCareerLevelColor(objective.career_level.color)}`}>
                  {objective.career_level.name}
                </span>
              </div>
            </div>

            <div className="mt-2">
              <div className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium border ${getCareerPathwayColor(objective.career_pathway.color)}`}>
                <BookOpen className="w-4 h-4 mr-2" />
                {objective.career_pathway.name}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100"
              title={showDetails ? t('common.hideDetails') : t('common.viewDetails')}
            >
              {showDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>

            {canEdit() && (
              <button
                onClick={handleEditClick}
                className="text-indigo-600 hover:text-indigo-900 p-2 rounded-lg hover:bg-indigo-50 cursor-pointer z-10"
                title={t('common.edit')}
              >
                <Edit className="w-4 h-4" />
              </button>
            )}

            {canDelete() && (
              <button
                onClick={() => onDelete(objective.id)}
                className="text-red-600 hover:text-red-900 p-2 rounded-lg hover:bg-red-50"
                title={t('common.delete')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Bouton de validation des objectifs */}
        {canValidate() && (
          <div className="mb-4">
            <button
              onClick={handleValidateObjectives}
              disabled={validating}
              className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              {validating ? t('annualObjectives.validating') : t('annualObjectives.validateObjectives')}
            </button>
          </div>
        )}

        {/* Bouton d'auto-évaluation */}
        {canEvaluate() && (
          <div className="mb-4">
            <button
              onClick={() => onStartEvaluation && onStartEvaluation(objective)}
              className="w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <Star className="w-4 h-4" />
              Commencer l'auto-évaluation
            </button>
          </div>
        )}

        {/* Résumé des objectifs */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">
              {objective.objectives.length} {t('common.skill', { count: objective.objectives.length })}
            </span>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-gray-400 hover:text-gray-600"
            >
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>

          {/* Résumé des objectifs par type */}
          <div className="flex flex-wrap gap-2">
            {objectiveCounts.career > 0 && (
              <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                {objectiveCounts.career} {t('objectives.careerObjectives')}{objectiveCounts.career > 1 ? 's' : ''}
              </div>
            )}
            {objectiveCounts.custom > 0 && (
              <div className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm">
                {objectiveCounts.custom} objectif{objectiveCounts.custom > 1 ? 's' : ''} SMART
              </div>
            )}
            {objectiveCounts.formation > 0 && (
              <div className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm">
                {objectiveCounts.formation} formation{objectiveCounts.formation > 1 ? 's' : ''}
              </div>
            )}
            {objectiveCounts.simple > 0 && (
              <div className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm">
                {objectiveCounts.simple} objectif{objectiveCounts.simple > 1 ? 's' : ''} simple{objectiveCounts.simple > 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>

        {/* Détails des objectifs */}
        {expanded && (
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
                      {obj.theme_name || `${t('objectives.theme')} ${index + 1}`}
                    </span>
                    {obj.is_custom && (
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                        {t('objectives.customized')}
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
                  <strong>{obj.is_custom && obj.objective_type !== 'smart' ? 'Objectif:' : t('objectives.smartObjective')}:</strong> {obj.smart_objective}
                </p>
                {showDetails && obj.is_custom && obj.objective_type === 'smart' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div>
                      <strong className="text-gray-600">{t('objectives.specific')}:</strong>
                      <p className="text-gray-700 mt-1">{obj.specific}</p>
                    </div>
                    <div>
                      <strong className="text-gray-600">{t('objectives.measurable')}:</strong>
                      <p className="text-gray-700 mt-1">{obj.measurable}</p>
                    </div>
                    <div>
                      <strong className="text-gray-600">{t('objectives.achievable')}:</strong>
                      <p className="text-gray-700 mt-1">{obj.achievable}</p>
                    </div>
                    <div>
                      <strong className="text-gray-600">{t('objectives.relevant')}:</strong>
                      <p className="text-gray-700 mt-1">{obj.relevant}</p>
                    </div>
                    <div className="md:col-span-2">
                      <strong className="text-gray-600">{t('objectives.timeBound')}:</strong>
                      <p className="text-gray-700 mt-1">{obj.time_bound}</p>
                    </div>
                  </div>
                )}
                {showDetails && !obj.is_custom && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div>
                      <strong className="text-gray-600">{t('objectives.specific')}:</strong>
                      <p className="text-gray-700 mt-1">{obj.specific}</p>
                    </div>
                    <div>
                      <strong className="text-gray-600">{t('objectives.measurable')}:</strong>
                      <p className="text-gray-700 mt-1">{obj.measurable}</p>
                    </div>
                    <div>
                      <strong className="text-gray-600">{t('objectives.achievable')}:</strong>
                      <p className="text-gray-700 mt-1">{obj.achievable}</p>
                    </div>
                    <div>
                      <strong className="text-gray-600">{t('objectives.relevant')}:</strong>
                      <p className="text-gray-700 mt-1">{obj.relevant}</p>
                    </div>
                    <div className="md:col-span-2">
                      <strong className="text-gray-600">{t('objectives.timeBound')}:</strong>
                      <p className="text-gray-700 mt-1">{obj.time_bound}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between items-center text-xs text-gray-500 mt-4 pt-4 border-t">
          <span>
            {t('common.createdOn')} {format(new Date(objective.created_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}
          </span>
          {objective.updated_at !== objective.created_at && (
            <span>
              {t('common.modifiedOn')} {format(new Date(objective.updated_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ObjectiveCard;