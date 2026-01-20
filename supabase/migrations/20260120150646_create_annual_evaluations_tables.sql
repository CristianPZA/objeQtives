/*
  # Créer les tables d'évaluations annuelles
  
  ## Description
  Ce fichier crée les tables nécessaires pour stocker les évaluations annuelles des objectifs des employés,
  incluant les auto-évaluations et les évaluations des coachs.
  
  ## 1. Nouvelles Tables
  
  ### `annual_evaluations` - Auto-évaluations des collaborateurs
  - `id` (uuid, primary key) - Identifiant unique de l'évaluation
  - `annual_objective_id` (uuid, foreign key) - Référence vers annual_objectives
  - `employee_id` (uuid, foreign key) - Référence vers user_profiles (l'employé)
  - `year` (integer) - Année de l'évaluation
  - `evaluations` (jsonb) - Détails des évaluations pour chaque objectif incluant:
    - objective_id: ID de l'objectif
    - skill_description: Description de la compétence
    - employee_score: Note du consultant de 1 à 5
    - employee_comment: Commentaire du consultant
    - achievements: Réalisations principales
    - difficulties: Difficultés rencontrées
    - learnings: Apprentissages principaux
    - next_steps: Prochaines étapes
  - `employee_global_comment` (text) - Commentaire global de l'employé sur l'année
  - `employee_global_score` (integer) - Auto-évaluation globale de 1 à 5
  - `status` (text) - Statut: draft, submitted, reviewed
  - `submitted_at` (timestamptz) - Date de soumission
  - `created_at` (timestamptz) - Date de création
  - `updated_at` (timestamptz) - Date de dernière mise à jour
  
  ### `annual_coach_evaluations` - Évaluations des coachs
  - `id` (uuid, primary key) - Identifiant unique de l'évaluation coach
  - `annual_evaluation_id` (uuid, foreign key) - Référence vers annual_evaluations
  - `annual_objective_id` (uuid, foreign key) - Référence vers annual_objectives
  - `coach_id` (uuid, foreign key) - Référence vers user_profiles (le coach)
  - `employee_id` (uuid, foreign key) - Référence vers user_profiles (l'employé)
  - `year` (integer) - Année de l'évaluation
  - `coach_evaluations` (jsonb) - Détails des évaluations du coach pour chaque objectif:
    - objective_id: ID de l'objectif
    - skill_description: Description de la compétence
    - coach_score: Note du coach de 1 à 5
    - coach_comment: Commentaire du coach
    - strengths: Points forts identifiés
    - areas_for_improvement: Axes d'amélioration
    - development_recommendations: Recommandations de développement
  - `coach_global_comment` (text) - Commentaire global du coach sur la performance annuelle
  - `coach_global_score` (integer) - Note finale du coach de 1 à 5
  - `status` (text) - Statut: draft, in_progress, completed
  - `completed_at` (timestamptz) - Date de finalisation
  - `created_at` (timestamptz) - Date de création
  - `updated_at` (timestamptz) - Date de dernière mise à jour
  
  ## 2. Security
  - RLS activé sur toutes les tables
  - Policies restrictives pour l'accès aux données
  - Les employés peuvent voir et créer leurs propres évaluations
  - Les coachs peuvent voir et créer les évaluations de leurs coachés
  - Les admins ont accès complet
  
  ## 3. Notes importantes
  - Les notes (scores) sont toujours de 1 à 5
  - Les évaluations sont stockées en JSON pour plus de flexibilité
  - Les commentaires globaux permettent une synthèse de l'année
  - Le système supporte un workflow: draft -> submitted -> reviewed/completed
*/

-- Créer la table annual_evaluations si elle n'existe pas déjà
CREATE TABLE IF NOT EXISTS annual_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  annual_objective_id uuid NOT NULL REFERENCES annual_objectives(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  year integer NOT NULL,
  evaluations jsonb NOT NULL DEFAULT '[]'::jsonb,
  employee_global_comment text,
  employee_global_score integer CHECK (employee_global_score >= 1 AND employee_global_score <= 5),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'reviewed')),
  submitted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Créer la table annual_coach_evaluations si elle n'existe pas déjà
CREATE TABLE IF NOT EXISTS annual_coach_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  annual_evaluation_id uuid NOT NULL REFERENCES annual_evaluations(id) ON DELETE CASCADE,
  annual_objective_id uuid NOT NULL REFERENCES annual_objectives(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  year integer NOT NULL,
  coach_evaluations jsonb NOT NULL DEFAULT '[]'::jsonb,
  coach_global_comment text,
  coach_global_score integer CHECK (coach_global_score >= 1 AND coach_global_score <= 5),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed')),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Créer les index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_annual_evaluations_employee ON annual_evaluations(employee_id);
CREATE INDEX IF NOT EXISTS idx_annual_evaluations_year ON annual_evaluations(year);
CREATE INDEX IF NOT EXISTS idx_annual_evaluations_objective ON annual_evaluations(annual_objective_id);
CREATE INDEX IF NOT EXISTS idx_annual_coach_evaluations_coach ON annual_coach_evaluations(coach_id);
CREATE INDEX IF NOT EXISTS idx_annual_coach_evaluations_employee ON annual_coach_evaluations(employee_id);
CREATE INDEX IF NOT EXISTS idx_annual_coach_evaluations_year ON annual_coach_evaluations(year);

-- Activer RLS sur les tables
ALTER TABLE annual_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE annual_coach_evaluations ENABLE ROW LEVEL SECURITY;

-- Policies pour annual_evaluations

-- Les employés peuvent voir leurs propres évaluations
CREATE POLICY "Employees can view own evaluations"
  ON annual_evaluations
  FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid());

-- Les employés peuvent créer leurs propres évaluations
CREATE POLICY "Employees can create own evaluations"
  ON annual_evaluations
  FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = auth.uid());

-- Les employés peuvent mettre à jour leurs propres évaluations si status = draft
CREATE POLICY "Employees can update own draft evaluations"
  ON annual_evaluations
  FOR UPDATE
  TO authenticated
  USING (employee_id = auth.uid() AND status = 'draft')
  WITH CHECK (employee_id = auth.uid());

-- Les coachs peuvent voir les évaluations de leurs coachés
CREATE POLICY "Coaches can view coachees evaluations"
  ON annual_evaluations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = annual_evaluations.employee_id
      AND user_profiles.coach_id = auth.uid()
    )
  );

-- Les admins peuvent tout voir
CREATE POLICY "Admins can view all evaluations"
  ON annual_evaluations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Les admins peuvent tout mettre à jour
CREATE POLICY "Admins can update all evaluations"
  ON annual_evaluations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Policies pour annual_coach_evaluations

-- Les coachs peuvent voir les évaluations qu'ils ont créées
CREATE POLICY "Coaches can view own coach evaluations"
  ON annual_coach_evaluations
  FOR SELECT
  TO authenticated
  USING (coach_id = auth.uid());

-- Les coachs peuvent créer des évaluations pour leurs coachés
CREATE POLICY "Coaches can create evaluations for coachees"
  ON annual_coach_evaluations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    coach_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = annual_coach_evaluations.employee_id
      AND user_profiles.coach_id = auth.uid()
    )
  );

-- Les coachs peuvent mettre à jour leurs propres évaluations
CREATE POLICY "Coaches can update own evaluations"
  ON annual_coach_evaluations
  FOR UPDATE
  TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- Les employés peuvent voir les évaluations de leur coach les concernant
CREATE POLICY "Employees can view coach evaluations about them"
  ON annual_coach_evaluations
  FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid());

-- Les admins peuvent tout voir
CREATE POLICY "Admins can view all coach evaluations"
  ON annual_coach_evaluations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Les admins peuvent tout mettre à jour
CREATE POLICY "Admins can update all coach evaluations"
  ON annual_coach_evaluations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );