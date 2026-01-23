export const getCareerLevelBadge = (level: { name: string, color: string }) => {
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

export const getStatusColor = (status: string) => {
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

export const getStatusLabel = (status: string, t: any) => {
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

export const getProjectStatusColor = (statut: string) => {
  switch (statut) {
    case 'en_cours':
      return 'bg-gray-100 text-gray-800';
    case 'termine':
      return 'bg-green-100 text-green-800';
    case 'suspendu':
      return 'bg-yellow-100 text-yellow-800';
    case 'annule':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const getProjectStatusLabel = (statut: string, t: any) => {
  switch (statut) {
    case 'en_cours':
      return t('projects.statuses.inProgress');
    case 'termine':
      return t('projects.statuses.completed');
    case 'suspendu':
      return t('projects.statuses.suspended');
    case 'annule':
      return t('projects.statuses.cancelled');
    default:
      return statut;
  }
};

export const getEvaluationStatusColor = (statut: string) => {
  switch (statut) {
    case 'brouillon':
      return 'bg-gray-100 text-gray-800';
    case 'soumise':
    case 'en_attente_referent':
      return 'bg-yellow-100 text-yellow-800';
    case 'evaluee_referent':
      return 'bg-purple-100 text-purple-800';
    case 'finalisee':
      return 'bg-green-100 text-green-800';
    case 'rejetee':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const getEvaluationStatusLabel = (statut: string) => {
  switch (statut) {
    case 'brouillon':
      return 'Brouillon';
    case 'soumise':
      return 'Soumise';
    case 'en_attente_referent':
      return 'En attente référent';
    case 'evaluee_referent':
      return 'Évaluée par référent';
    case 'finalisee':
      return 'Finalisée';
    case 'rejetee':
      return 'Rejetée';
    default:
      return statut;
  }
};

export const getScoreStars = (score: number) => {
  return Array.from({ length: 5 }, (_, i) => (
    <Star 
      key={i} 
      className={`w-4 h-4 ${i < score ? 'fill-current text-yellow-400' : 'text-gray-300'}`} 
    />
  ));
};

export const getScoreBadgeColor = (score: number) => {
  if (score >= 4.5) return 'bg-green-100 text-green-800';
  if (score >= 3.5) return 'bg-blue-100 text-blue-800';
  if (score >= 2.5) return 'bg-orange-100 text-orange-800';
  return 'bg-red-100 text-red-800';
};

// Import needed for the Star icon
import { Star } from 'lucide-react';