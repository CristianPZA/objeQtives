import React, { useState, useEffect } from 'react';
import { X, Star, Target, TrendingUp, AlertCircle, CheckCircle, Award } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';

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
  objective_type?: string;
}

interface EvaluationData {
  objective_id: string;
  skill_description: string;
  employee_score: number;
  employee_comment: string;
  achievements: string;
  difficulties: string;
  learnings: string;
  next_steps: string;
}

interface AnnualEvaluation {
  id: string;
  annual_objective_id: string;
  employee_id: string;
  year: number;
  evaluations: EvaluationData[];
  employee_global_comment: string;
  employee_global_score: number;
  promotion_request: boolean;
  promotion_justification: string;
  status: string;
  submitted_at: string;
}

interface CoachEvaluationData {
  objective_id: string;
  skill_description: string;
  coach_score: number;
  coach_comment: string;
  strengths: string;
  areas_for_improvement: string;
  development_recommendations: string;
}

interface AnnualCoachEvaluation {
  id: string;
  annual_evaluation_id: string;
  annual_objective_id: string;
  coach_id: string;
  employee_id: string;
  year: number;
  coach_evaluations: CoachEvaluationData[];
  coach_global_comment: string;
  coach_global_score: number;
  status: string;
  completed_at: string;
}

interface ViewAnnualEvaluationModalProps {
  objective: any;
  onClose: () => void;
  userRole: string;
  currentUserId: string;
}

const ViewAnnualEvaluationModal: React.FC<ViewAnnualEvaluationModalProps> = ({
  objective,
  onClose,
  userRole,
  currentUserId
}) => {
  const { t } = useTranslation();
  const [evaluation, setEvaluation] = useState<AnnualEvaluation | null>(null);
  const [coachEvaluation, setCoachEvaluation] = useState<AnnualCoachEvaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEvaluation();
  }, []);

  const fetchEvaluation = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('annual_evaluations')
        .select('*')
        .eq('annual_objective_id', objective.id)
        .eq('employee_id', objective.employee_id)
        .eq('year', objective.year)
        .maybeSingle();

      if (error) throw error;
      setEvaluation(data);

      if (data?.id) {
        const { data: coachData, error: coachError } = await supabase
          .from('annual_coach_evaluations')
          .select('*')
          .eq('annual_evaluation_id', data.id)
          .eq('employee_id', objective.employee_id)
          .maybeSingle();

        if (coachError) throw coachError;
        setCoachEvaluation(coachData || null);
      } else {
        setCoachEvaluation(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const getScoreLabel = (score: number) => {
    switch (score) {
      case 1: return t('evaluation.scores.notAchieved');
      case 2: return t('evaluation.scores.partiallyAchieved');
      case 3: return t('evaluation.scores.achieved');
      case 4: return t('evaluation.scores.largelyAchieved');
      case 5: return t('evaluation.scores.exceeded');
      default: return t('evaluation.scores.achieved');
    }
  };

  const getScoreColor = (score: number) => {
    switch (score) {
      case 1: return 'text-red-600 bg-red-50';
      case 2: return 'text-orange-600 bg-orange-50';
      case 3: return 'text-blue-600 bg-blue-50';
      case 4: return 'text-green-600 bg-green-50';
      case 5: return 'text-emerald-600 bg-emerald-50';
      default: return 'text-blue-600 bg-blue-50';
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-gray-700">Chargement...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !evaluation) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-8 max-w-md">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-gray-900">Erreur</h3>
              <p className="text-sm text-gray-600 mt-1">{error || 'Aucune auto-évaluation trouvée'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="mt-4 w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-6xl w-full my-8">
        <div className="sticky top-0 bg-white p-6 border-b flex justify-between items-center rounded-t-lg z-10">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Auto-évaluation {objective.year}</h2>
            <p className="text-sm text-gray-600 mt-1">
              Consultant : {objective.employee.full_name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 max-h-[calc(90vh-180px)] overflow-y-auto">
          {/* Évaluation globale */}
          <div className="mb-8 border border-gray-200 rounded-lg p-6 bg-gradient-to-br from-blue-50 to-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Target className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Évaluation globale de l'année</h3>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-gray-700">Note globale :</span>
                  <div className={`px-3 py-1 rounded-full ${getScoreColor(evaluation.employee_global_score)}`}>
                    <div className="flex items-center gap-2">
                      {Array.from({ length: evaluation.employee_global_score }, (_, i) => (
                        <Star key={i} className="w-4 h-4 fill-current text-yellow-400" />
                      ))}
                      <span className="text-sm font-medium ml-1">
                        {getScoreLabel(evaluation.employee_global_score)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Commentaire global :</h4>
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <p className="text-gray-700 whitespace-pre-wrap">{evaluation.employee_global_comment}</p>
                </div>
              </div>

              {/* Demande de promotion */}
              {evaluation.promotion_request && (
                <div className="mt-4 border-t pt-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <Award className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-amber-900">Demande de promotion</h4>
                      <p className="text-xs text-amber-700">Le consultant postule pour une promotion</p>
                    </div>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{evaluation.promotion_justification}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Évaluation du coach */}
          {(currentUserId === objective.employee_id || userRole === 'admin' || userRole === 'coach') && (
            <div className="mb-8 border border-gray-200 rounded-lg p-6 bg-gradient-to-br from-purple-50 to-white">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Évaluation du coach</h3>
              </div>

              {!coachEvaluation ? (
                <div className="bg-white border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
                  L'évaluation du coach n'est pas encore disponible.
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-gray-700">Note globale :</span>
                      <div className={`px-3 py-1 rounded-full ${getScoreColor(coachEvaluation.coach_global_score)}`}>
                        <div className="flex items-center gap-2">
                          {Array.from({ length: coachEvaluation.coach_global_score }, (_, i) => (
                            <Star key={i} className="w-4 h-4 fill-current text-yellow-400" />
                          ))}
                          <span className="text-sm font-medium ml-1">
                            {getScoreLabel(coachEvaluation.coach_global_score)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Commentaire global du coach :</h4>
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <p className="text-gray-700 whitespace-pre-wrap">{coachEvaluation.coach_global_comment}</p>
                    </div>
                  </div>

                  {coachEvaluation.completed_at && (
                    <div className="text-xs text-gray-500">
                      Évaluation coach réalisée le {new Date(coachEvaluation.completed_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Évaluations par objectif */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Détail par objectif</h3>

            {evaluation.evaluations.map((evalItem: EvaluationData, index: number) => {
              const objectiveDetail = objective.objectives.find(
                (obj: ObjectiveDetail) => obj.skill_id === evalItem.objective_id
              );
              const coachEvalItem = coachEvaluation?.coach_evaluations?.find(
                (coachItem: CoachEvaluationData) => coachItem.objective_id === evalItem.objective_id
              );

              if (!objectiveDetail) return null;

              return (
                <div key={evalItem.objective_id} className="border border-gray-200 rounded-lg p-6 bg-white">
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-1 rounded ${
                        objectiveDetail.is_custom
                          ? objectiveDetail.objective_type === 'formation'
                            ? 'bg-orange-100 text-orange-700'
                            : objectiveDetail.objective_type === 'custom'
                              ? 'bg-indigo-100 text-indigo-700'
                              : 'bg-purple-100 text-purple-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {objectiveDetail.theme_name}
                      </span>
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">
                      {index + 1}. {evalItem.skill_description}
                    </h4>
                    <div className="bg-gray-50 rounded-lg p-3 mb-4">
                      <p className="text-sm text-gray-700">
                        <strong>Objectif SMART :</strong> {objectiveDetail.smart_objective}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {/* Score */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">Niveau d'atteinte :</span>
                      <div className={`px-3 py-1 rounded-full ${getScoreColor(evalItem.employee_score)}`}>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: evalItem.employee_score }, (_, i) => (
                            <Star key={i} className="w-3 h-3 fill-current text-yellow-400" />
                          ))}
                          <span className="text-xs font-medium ml-1">
                            {getScoreLabel(evalItem.employee_score)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Commentaire */}
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-1">Commentaire :</h5>
                      <p className="text-sm text-gray-600 bg-gray-50 rounded p-3">{evalItem.employee_comment}</p>
                    </div>

                    {/* Réalisations */}
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-1">Principales réalisations :</h5>
                      <p className="text-sm text-gray-600 bg-green-50 rounded p-3">{evalItem.achievements}</p>
                    </div>

                    {/* Difficultés */}
                    {evalItem.difficulties && (
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 mb-1">Difficultés rencontrées :</h5>
                        <p className="text-sm text-gray-600 bg-orange-50 rounded p-3">{evalItem.difficulties}</p>
                      </div>
                    )}

                    {/* Apprentissages */}
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-1">Principaux apprentissages :</h5>
                      <p className="text-sm text-gray-600 bg-blue-50 rounded p-3">{evalItem.learnings}</p>
                    </div>

                    {/* Prochaines étapes */}
                    {evalItem.next_steps && (
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 mb-1">Prochaines étapes :</h5>
                        <p className="text-sm text-gray-600 bg-purple-50 rounded p-3">{evalItem.next_steps}</p>
                      </div>
                    )}
                  </div>

                  {/* Évaluation coach */}
                  {coachEvalItem && (
                    <div className="mt-4 border-t pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-gray-700">Évaluation coach :</span>
                        <div className={`px-3 py-1 rounded-full ${getScoreColor(coachEvalItem.coach_score)}`}>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: coachEvalItem.coach_score }, (_, i) => (
                              <Star key={i} className="w-3 h-3 fill-current text-yellow-400" />
                            ))}
                            <span className="text-xs font-medium ml-1">
                              {getScoreLabel(coachEvalItem.coach_score)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <h5 className="text-sm font-medium text-gray-700 mb-1">Commentaire :</h5>
                          <p className="text-sm text-gray-600 bg-purple-50 rounded p-3">{coachEvalItem.coach_comment}</p>
                        </div>
                        <div>
                          <h5 className="text-sm font-medium text-gray-700 mb-1">Points forts :</h5>
                          <p className="text-sm text-gray-600 bg-green-50 rounded p-3">{coachEvalItem.strengths}</p>
                        </div>
                        {coachEvalItem.areas_for_improvement && (
                          <div>
                            <h5 className="text-sm font-medium text-gray-700 mb-1">Axes d'amélioration :</h5>
                            <p className="text-sm text-gray-600 bg-orange-50 rounded p-3">{coachEvalItem.areas_for_improvement}</p>
                          </div>
                        )}
                        {coachEvalItem.development_recommendations && (
                          <div>
                            <h5 className="text-sm font-medium text-gray-700 mb-1">Recommandations :</h5>
                            <p className="text-sm text-gray-600 bg-blue-50 rounded p-3">{coachEvalItem.development_recommendations}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Information sur la soumission */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>
                Auto-évaluation soumise le {new Date(evaluation.submitted_at).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 bg-white p-6 border-t flex justify-end rounded-b-lg">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViewAnnualEvaluationModal;
