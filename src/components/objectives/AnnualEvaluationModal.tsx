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

interface AnnualEvaluationData {
  objective_id: string;
  skill_description: string;
  employee_score: number;
  employee_comment: string;
  achievements: string;
  difficulties: string;
  learnings: string;
  next_steps: string;
}

interface AnnualEvaluationModalProps {
  objective: any;
  onClose: () => void;
  onSuccess: () => void;
  onError: (error: string) => void;
}

const AnnualEvaluationModal: React.FC<AnnualEvaluationModalProps> = ({
  objective,
  onClose,
  onSuccess,
  onError
}) => {
  const { t } = useTranslation();
  const [evaluations, setEvaluations] = useState<AnnualEvaluationData[]>(
    objective.objectives.map((obj: ObjectiveDetail) => ({
      objective_id: obj.skill_id,
      skill_description: obj.skill_description,
      employee_score: 3,
      employee_comment: '',
      achievements: '',
      difficulties: '',
      learnings: '',
      next_steps: ''
    }))
  );
  const [employeeGlobalComment, setEmployeeGlobalComment] = useState('');
  const [employeeGlobalScore, setEmployeeGlobalScore] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [showGlobalEvaluation, setShowGlobalEvaluation] = useState(false);

  const handleEvaluationChange = (index: number, field: keyof AnnualEvaluationData, value: string | number) => {
    setEvaluations(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const validateCurrentEvaluation = () => {
    const current = evaluations[currentStep];
    return current.employee_comment.trim() !== '' &&
           current.achievements.trim() !== '' &&
           current.learnings.trim() !== '';
  };

  const validateAllEvaluations = () => {
    return evaluations.every(evalItem =>
      evalItem.employee_comment.trim() !== '' &&
      evalItem.achievements.trim() !== '' &&
      evalItem.learnings.trim() !== ''
    ) && employeeGlobalComment.trim() !== '';
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

      // Vérifier si une évaluation existe déjà
      const { data: existingEval } = await supabase
        .from('annual_evaluations')
        .select('id')
        .eq('annual_objective_id', objective.id)
        .eq('employee_id', objective.employee_id)
        .eq('year', objective.year)
        .maybeSingle();

      const evaluationData = {
        annual_objective_id: objective.id,
        employee_id: objective.employee_id,
        year: objective.year,
        evaluations: evaluations,
        employee_global_comment: employeeGlobalComment,
        employee_global_score: employeeGlobalScore,
        status: 'submitted',
        submitted_at: new Date().toISOString()
      };

      if (existingEval) {
        // Mettre à jour l'évaluation existante
        const { error } = await supabase
          .from('annual_evaluations')
          .update(evaluationData)
          .eq('id', existingEval.id);

        if (error) throw error;
      } else {
        // Créer une nouvelle évaluation
        const { error } = await supabase
          .from('annual_evaluations')
          .insert([evaluationData]);

        if (error) throw error;
      }

      // Marquer les notifications comme lues
      await markNotificationsAsRead();

      // Mettre à jour le statut de l'objectif annuel
      await supabase
        .from('annual_objectives')
        .update({ status: 'waiting auto evaluation' })
        .eq('id', objective.id);

      onSuccess();
    } catch (err) {
      onError(err instanceof Error ? err.message : t('evaluation.errorSubmitting'));
    } finally {
      setSubmitting(false);
    }
  };

  const markNotificationsAsRead = async () => {
    try {
      // Récupérer les notifications liées à cette évaluation annuelle
      const { data: notifications } = await supabase
        .from('notifications')
        .select('id')
        .eq('destinataire_id', objective.employee_id)
        .eq('is_read', false)
        .eq('is_archived', false)
        .contains('metadata', { year: objective.year, action_type: 'annual_evaluation_required' });

      if (notifications && notifications.length > 0) {
        // Marquer les notifications comme lues et archivées
        const notificationIds = notifications.map(n => n.id);
        
        await supabase
          .from('notifications')
          .update({ 
            is_read: true,
            is_archived: true,
            read_at: new Date().toISOString()
          })
          .in('id', notificationIds);
      }
    } catch (err) {
      console.error('Error marking notifications as read:', err);
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
  const currentEvaluation = evaluations[currentStep];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Auto-évaluation annuelle {objective.year}</h2>
            <p className="text-sm text-gray-600 mt-1">
              {t('evaluation.evaluateEachObjective')}
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
                <h3 className="text-sm font-medium text-blue-800">{t('evaluation.selfEvaluationInstructions')}</h3>
                <p className="text-sm text-blue-700 mt-1">
                  Évaluez chacun de vos objectifs annuels en indiquant votre niveau d'atteinte, vos réalisations, 
                  les difficultés rencontrées et vos apprentissages.
                </p>
              </div>
            </div>
          </div>

          {showGlobalEvaluation ? (
            <div className="space-y-6">
              {/* Évaluation globale */}
              <div className="border border-gray-200 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-6">Évaluation globale de l'année</h3>

                <div className="space-y-6">
                  {/* Note globale */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Votre évaluation globale de l'année *
                    </label>
                    <div className="grid grid-cols-5 gap-2">
                      {[1, 2, 3, 4, 5].map((score) => (
                        <button
                          key={score}
                          type="button"
                          onClick={() => setEmployeeGlobalScore(score)}
                          className={`p-3 rounded-lg border-2 transition-all text-center ${
                            employeeGlobalScore === score
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

                  {/* Commentaire global */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Commentaire global sur votre année *
                    </label>
                    <textarea
                      rows={6}
                      value={employeeGlobalComment}
                      onChange={(e) => setEmployeeGlobalComment(e.target.value)}
                      placeholder="Faites une synthèse de votre année, vos principales réalisations, vos apprentissages et vos perspectives d'évolution..."
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
                      {t('objectives.customized')}
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {currentStep + 1}. {currentObjective.skill_description}
                </h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-700">
                    <strong>{t('objectives.smartObjective')}:</strong> {currentObjective.smart_objective}
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                {/* Score d'auto-évaluation */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    {t('evaluation.achievementLevel')} *
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <button
                        key={score}
                        type="button"
                        onClick={() => handleEvaluationChange(currentStep, 'employee_score', score)}
                        className={`p-3 rounded-lg border-2 transition-all text-center ${
                          currentEvaluation.employee_score === score
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

                {/* Commentaire sur l'évaluation */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('evaluation.evaluationComment')} *
                  </label>
                  <textarea
                    rows={3}
                    value={currentEvaluation.employee_comment}
                    onChange={(e) => handleEvaluationChange(currentStep, 'employee_comment', e.target.value)}
                    placeholder={t('evaluation.evaluationComment')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                {/* Réalisations */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('evaluation.mainAchievements')} *
                  </label>
                  <textarea
                    rows={3}
                    value={currentEvaluation.achievements}
                    onChange={(e) => handleEvaluationChange(currentStep, 'achievements', e.target.value)}
                    placeholder={t('evaluation.mainAchievements')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                {/* Difficultés rencontrées */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('evaluation.difficultiesEncountered')}
                  </label>
                  <textarea
                    rows={2}
                    value={currentEvaluation.difficulties}
                    onChange={(e) => handleEvaluationChange(currentStep, 'difficulties', e.target.value)}
                    placeholder={t('evaluation.difficultiesEncountered')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                {/* Apprentissages */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('evaluation.mainLearnings')} *
                  </label>
                  <textarea
                    rows={3}
                    value={currentEvaluation.learnings}
                    onChange={(e) => handleEvaluationChange(currentStep, 'learnings', e.target.value)}
                    placeholder={t('evaluation.mainLearnings')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                {/* Prochaines étapes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('evaluation.nextSteps')}
                  </label>
                  <textarea
                    rows={2}
                    value={currentEvaluation.next_steps}
                    onChange={(e) => handleEvaluationChange(currentStep, 'next_steps', e.target.value)}
                    placeholder={t('evaluation.nextSteps')}
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
                  {submitting ? t('common.loading') : t('evaluation.submitEvaluation')}
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
                  Évaluation globale
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnnualEvaluationModal;