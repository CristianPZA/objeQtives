import React, { useState } from 'react';
import { X, Save, Star, CheckCircle, AlertCircle, Target } from 'lucide-react';
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

interface CoachEvaluationData {
  objective_id: string;
  skill_description: string;
  coach_score: number;
  coach_comment: string;
  strengths: string;
  areas_for_improvement: string;
  development_recommendations: string;
}

interface AnnualEvaluationCoachModalProps {
  objective: any;
  employeeEvaluation: any;
  onClose: () => void;
  onSuccess: () => void;
  onError: (error: string) => void;
}

const AnnualEvaluationCoachModal: React.FC<AnnualEvaluationCoachModalProps> = ({
  objective,
  employeeEvaluation,
  onClose,
  onSuccess,
  onError
}) => {
  const { t } = useTranslation();
  const [coachEvaluations, setCoachEvaluations] = useState<CoachEvaluationData[]>(
    objective.objectives.map((obj: ObjectiveDetail) => ({
      objective_id: obj.skill_id,
      skill_description: obj.skill_description,
      coach_score: 3,
      coach_comment: '',
      strengths: '',
      areas_for_improvement: '',
      development_recommendations: ''
    }))
  );
  const [coachGlobalComment, setCoachGlobalComment] = useState('');
  const [coachGlobalScore, setCoachGlobalScore] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [showGlobalEvaluation, setShowGlobalEvaluation] = useState(false);

  const handleEvaluationChange = (index: number, field: keyof CoachEvaluationData, value: string | number) => {
    setCoachEvaluations(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const validateCurrentEvaluation = () => {
    const current = coachEvaluations[currentStep];
    return current.coach_comment.trim() !== '' &&
           current.strengths.trim() !== '';
  };

  const validateAllEvaluations = () => {
    return coachEvaluations.every(evalItem =>
      evalItem.coach_comment.trim() !== '' &&
      evalItem.strengths.trim() !== ''
    ) && coachGlobalComment.trim() !== '';
  };

  const handleNext = () => {
    if (validateCurrentEvaluation()) {
      if (currentStep === objective.objectives.length - 1) {
        setShowGlobalEvaluation(true);
      } else {
        setCurrentStep(prev => Math.min(prev + 1, objective.objectives.length - 1));
      }
    } else {
      onError(t('evaluation.fillRequiredFields'));
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const handleSubmit = async () => {
    if (!validateAllEvaluations()) {
      onError(t('evaluation.fillRequiredFields'));
      return;
    }

    try {
      setSubmitting(true);

      // Récupérer le coach_id de l'utilisateur connecté
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utilisateur non connecté');

      // Vérifier si une évaluation coach existe déjà
      const { data: existingEval } = await supabase
        .from('annual_coach_evaluations')
        .select('id')
        .eq('annual_evaluation_id', employeeEvaluation.id)
        .eq('annual_objective_id', objective.id)
        .eq('coach_id', user.id)
        .maybeSingle();

      const evaluationData = {
        annual_evaluation_id: employeeEvaluation.id,
        annual_objective_id: objective.id,
        coach_id: user.id,
        employee_id: objective.employee_id,
        year: objective.year,
        coach_evaluations: coachEvaluations,
        coach_global_comment: coachGlobalComment,
        coach_global_score: coachGlobalScore,
        status: 'completed',
        completed_at: new Date().toISOString()
      };

      if (existingEval) {
        // Mettre à jour l'évaluation existante
        const { error } = await supabase
          .from('annual_coach_evaluations')
          .update(evaluationData)
          .eq('id', existingEval.id);

        if (error) throw error;
      } else {
        // Créer une nouvelle évaluation
        const { error } = await supabase
          .from('annual_coach_evaluations')
          .insert([evaluationData]);

        if (error) throw error;
      }

      // Mettre à jour le statut de l'évaluation annuelle et de l'objectif
      await supabase
        .from('annual_evaluations')
        .update({ status: 'reviewed' })
        .eq('id', employeeEvaluation.id);

      await supabase
        .from('annual_objectives')
        .update({ status: 'evaluated' })
        .eq('id', objective.id);

      await createCoachEvaluationNotification(user.id);

      onSuccess();
    } catch (err) {
      onError(err instanceof Error ? err.message : t('evaluation.errorSubmitting'));
    } finally {
      setSubmitting(false);
    }
  };

  const createCoachEvaluationNotificationLegacy = async (coachId: string) => {
    try {
      const employeeName = objective?.employee?.full_name || 'votre coach';
      const { error } = await supabase
        .from('notifications')
        .insert([{
          destinataire_id: objective.employee_id,
          expediteur_id: coachId,
          titre: 'Évaluation annuelle du coach disponible',
          message: `Votre coach ${employeeName} a complété votre évaluation annuelle. Vous შეგიძლიათ la consulter dans vos objectifs annuels.`,
          type: 'info',
          priority: 2,
          action_url: '/objectifs-annuels',
          metadata: {
            annual_objective_id: objective.id,
            annual_evaluation_id: employeeEvaluation.id,
            year: objective.year,
            action_type: 'annual_coach_evaluation_completed'
          }
        }]);

      if (error) {
        console.error('Erreur lors de la création de la notification coach:', error);
      }
    } catch (err) {
      console.error('Erreur lors de la création de la notification coach:', err);
    }
  };

  const createCoachEvaluationNotification = async (coachId: string) => {
    try {
      const { data: coachProfile } = await supabase
        .from('user_profiles')
        .select('full_name')
        .eq('id', coachId)
        .maybeSingle();
      const coachName = coachProfile?.full_name || 'votre coach';
      const { error } = await supabase
        .from('notifications')
        .insert([{
          destinataire_id: objective.employee_id,
          expediteur_id: coachId,
          titre: 'Évaluation annuelle du coach disponible',
          message: `Votre coach ${coachName} a complété votre évaluation annuelle. Vous pouvez la consulter dans vos objectifs annuels.`,
          type: 'info',
          priority: 2,
          action_url: '/objectifs-annuels',
          metadata: {
            annual_objective_id: objective.id,
            annual_evaluation_id: employeeEvaluation.id,
            year: objective.year,
            action_type: 'annual_coach_evaluation_completed'
          }
        }]);

      if (error) {
        console.error('Erreur lors de la création de la notification coach:', error);
      }
    } catch (err) {
      console.error('Erreur lors de la création de la notification coach:', err);
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
      case 1: return 'text-red-600';
      case 2: return 'text-orange-600';
      case 3: return 'text-blue-600';
      case 4: return 'text-green-600';
      case 5: return 'text-emerald-600';
      default: return 'text-blue-600';
    }
  };

  const currentObjective = objective.objectives[currentStep];
  const currentCoachEvaluation = coachEvaluations[currentStep];
  const currentEmployeeEvaluation = employeeEvaluation?.evaluations?.[currentStep];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Évaluation Coach - Objectifs {objective.year}</h2>
            <p className="text-sm text-gray-600 mt-1">
              Évaluez les objectifs annuels de {objective.employee.full_name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Progression */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">
                Objectif {currentStep + 1} sur {objective.objectives.length}
              </span>
              <span className="text-sm text-gray-500">
                {Math.round(((currentStep + 1) / objective.objectives.length) * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full"
                style={{ width: `${((currentStep + 1) / objective.objectives.length) * 100}%` }}
              ></div>
            </div>
          </div>

          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Target className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-blue-800">Instructions pour l'évaluation coach</h3>
                <p className="text-sm text-blue-700 mt-1">
                  Évaluez chacun des objectifs annuels de votre coaché en vous basant sur son auto-évaluation.
                  Fournissez des commentaires constructifs et des recommandations pour son développement.
                </p>
              </div>
            </div>
          </div>

          {showGlobalEvaluation ? (
            <div className="space-y-6">
              {/* Évaluation globale du coach */}
              <div className="border border-gray-200 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-6">Évaluation globale du coach</h3>

                <div className="space-y-6">
                  {/* Note finale du coach */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Note finale de performance *
                    </label>
                    <div className="grid grid-cols-5 gap-2">
                      {[1, 2, 3, 4, 5].map((score) => (
                        <button
                          key={score}
                          type="button"
                          onClick={() => setCoachGlobalScore(score)}
                          className={`p-3 rounded-lg border-2 transition-all text-center ${
                            coachGlobalScore === score
                              ? 'border-indigo-500 bg-indigo-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex">
                              {Array.from({ length: score }, (_, i) => (
                                <Star key={i} className="w-4 h-4 fill-current text-yellow-400" />
                              ))}
                            </div>
                            <span className={`text-xs font-medium ${getScoreColor(score)}`}>
                              {getScoreLabel(score)}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Commentaire global du coach */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Commentaire global sur la performance annuelle *
                    </label>
                    <textarea
                      rows={6}
                      value={coachGlobalComment}
                      onChange={(e) => setCoachGlobalComment(e.target.value)}
                      placeholder="Faites une synthèse de la performance annuelle du collaborateur, ses points forts, axes d'amélioration et recommandations pour son développement..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Objectif courant */}
              <div className="border border-gray-200 rounded-lg p-6">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-1 rounded ${
                    currentObjective.is_custom 
                      ? currentObjective.objective_type === 'formation' 
                        ? 'bg-orange-100 text-orange-700' 
                        : currentObjective.objective_type === 'custom' 
                          ? 'bg-indigo-100 text-indigo-700' 
                          : 'bg-purple-100 text-purple-700' 
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {currentObjective.theme_name}
                  </span>
                  {currentObjective.is_custom && (
                    <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                      Personnalisé
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {currentStep + 1}. {currentObjective.skill_description}
                </h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-700">
                    <strong>Objectif:</strong> {currentObjective.smart_objective}
                  </p>
                </div>
              </div>

              {/* Auto-évaluation de l'employé */}
              {currentEmployeeEvaluation && (
                <div className="mb-6 bg-blue-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-800 mb-2">Auto-évaluation de l'employé</h4>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-blue-700">Score:</span>
                    <div className="flex">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star 
                          key={i} 
                          className={`w-4 h-4 ${i < currentEmployeeEvaluation.employee_score ? 'fill-current text-yellow-400' : 'text-gray-300'}`} 
                        />
                      ))}
                    </div>
                    <span className="text-sm text-blue-700">({currentEmployeeEvaluation.employee_score}/5)</span>
                  </div>
                  <p className="text-sm text-blue-700">
                    <strong>Commentaire:</strong> {currentEmployeeEvaluation.employee_comment}
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    <strong>Réalisations:</strong> {currentEmployeeEvaluation.achievements}
                  </p>
                  {currentEmployeeEvaluation.difficulties && (
                    <p className="text-sm text-blue-700 mt-1">
                      <strong>Difficultés:</strong> {currentEmployeeEvaluation.difficulties}
                    </p>
                  )}
                  {currentEmployeeEvaluation.learnings && (
                    <p className="text-sm text-blue-700 mt-1">
                      <strong>Apprentissages:</strong> {currentEmployeeEvaluation.learnings}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-6">
                {/* Score du coach */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Votre évaluation de la performance *
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <button
                        key={score}
                        type="button"
                        onClick={() => handleEvaluationChange(currentStep, 'coach_score', score)}
                        className={`p-3 rounded-lg border-2 transition-all text-center ${
                          currentCoachEvaluation.coach_score === score
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex">
                            {Array.from({ length: score }, (_, i) => (
                              <Star key={i} className="w-4 h-4 fill-current text-yellow-400" />
                            ))}
                          </div>
                          <span className={`text-xs font-medium ${getScoreColor(score)}`}>
                            {getScoreLabel(score)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Commentaire du coach */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Commentaire sur votre évaluation *
                  </label>
                  <textarea
                    rows={3}
                    value={currentCoachEvaluation.coach_comment}
                    onChange={(e) => handleEvaluationChange(currentStep, 'coach_comment', e.target.value)}
                    placeholder="Donnez votre avis sur l'atteinte de cet objectif..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                {/* Points forts */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Points forts identifiés *
                  </label>
                  <textarea
                    rows={3}
                    value={currentCoachEvaluation.strengths}
                    onChange={(e) => handleEvaluationChange(currentStep, 'strengths', e.target.value)}
                    placeholder="Quels sont les points forts démontrés par l'employé sur cet objectif ?"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                {/* Axes d'amélioration */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Axes d'amélioration
                  </label>
                  <textarea
                    rows={2}
                    value={currentCoachEvaluation.areas_for_improvement}
                    onChange={(e) => handleEvaluationChange(currentStep, 'areas_for_improvement', e.target.value)}
                    placeholder="Quels sont les points à améliorer ?"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                {/* Recommandations de développement */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Recommandations de développement
                  </label>
                  <textarea
                    rows={2}
                    value={currentCoachEvaluation.development_recommendations}
                    onChange={(e) => handleEvaluationChange(currentStep, 'development_recommendations', e.target.value)}
                    placeholder="Quelles actions recommandez-vous pour développer cette compétence ?"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>
          )}

          {/* Navigation et actions */}
          <div className="flex justify-between pt-6 border-t mt-8">
            <div>
              {!showGlobalEvaluation && currentStep > 0 && (
                <button
                  onClick={handlePrevious}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Précédent
                </button>
              )}
              {showGlobalEvaluation && (
                <button
                  onClick={() => setShowGlobalEvaluation(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Retour aux objectifs
                </button>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                {t('common.cancel')}
              </button>

              {showGlobalEvaluation ? (
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !validateAllEvaluations()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {submitting ? t('common.loading') : 'Soumettre l\'évaluation'}
                </button>
              ) : currentStep < objective.objectives.length - 1 ? (
                <button
                  onClick={handleNext}
                  disabled={!validateCurrentEvaluation()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Suivant
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  disabled={!validateCurrentEvaluation()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Évaluation finale
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnnualEvaluationCoachModal;