/*
  # Ajout de la demande de promotion et évaluation coach

  1. Modifications à annual_evaluations
    - Ajout du champ `promotion_request` (boolean) pour indiquer si le consultant demande une promotion
    - Ajout du champ `promotion_justification` (text) pour la justification de la demande
  
  2. Nouvelle table `annual_evaluations_coach`
    - `id` (uuid, primary key)
    - `annual_evaluation_id` (uuid, référence vers annual_evaluations)
    - `annual_objective_id` (uuid, référence vers annual_objectives)
    - `employee_id` (uuid, référence vers user_profiles)
    - `coach_id` (uuid, référence vers user_profiles)
    - `year` (integer)
    - `evaluations` (jsonb) - évaluations des compétences par le coach
    - `coach_global_comment` (text) - commentaire global du coach
    - `coach_global_score` (integer) - note globale du coach (0-100)
    - `promotion_recommendation` (boolean) - recommandation du coach pour la promotion
    - `promotion_recommendation_comment` (text) - justification de la recommandation
    - `status` (text) - statut de l'évaluation coach
    - `submitted_at` (timestamp)
    - `created_at` (timestamp)
    - `updated_at` (timestamp)

  3. Sécurité
    - Activer RLS sur la nouvelle table
    - Les consultants peuvent voir leurs propres évaluations coach
    - Les coaches peuvent voir et modifier les évaluations de leurs consultants
    - Les admins peuvent tout voir
*/

-- Ajouter les champs de demande de promotion à annual_evaluations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'annual_evaluations' AND column_name = 'promotion_request'
  ) THEN
    ALTER TABLE annual_evaluations ADD COLUMN promotion_request boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'annual_evaluations' AND column_name = 'promotion_justification'
  ) THEN
    ALTER TABLE annual_evaluations ADD COLUMN promotion_justification text;
  END IF;
END $$;

-- Créer la table pour les évaluations du coach
CREATE TABLE IF NOT EXISTS annual_evaluations_coach (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  annual_evaluation_id uuid REFERENCES annual_evaluations(id) ON DELETE CASCADE,
  annual_objective_id uuid REFERENCES annual_objectives(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  coach_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  year integer NOT NULL,
  evaluations jsonb NOT NULL DEFAULT '[]'::jsonb,
  coach_global_comment text,
  coach_global_score integer CHECK (coach_global_score >= 0 AND coach_global_score <= 100),
  promotion_recommendation boolean DEFAULT false,
  promotion_recommendation_comment text,
  status text NOT NULL DEFAULT 'draft',
  submitted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Activer RLS
ALTER TABLE annual_evaluations_coach ENABLE ROW LEVEL SECURITY;

-- Les consultants peuvent voir leurs propres évaluations coach
CREATE POLICY "Employees can view their own coach evaluations"
  ON annual_evaluations_coach
  FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid());

-- Les coaches peuvent voir les évaluations de leurs consultants
CREATE POLICY "Coaches can view their consultants' evaluations"
  ON annual_evaluations_coach
  FOR SELECT
  TO authenticated
  USING (
    coach_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('coach', 'admin')
    )
  );

-- Les coaches peuvent créer des évaluations pour leurs consultants
CREATE POLICY "Coaches can create evaluations for their consultants"
  ON annual_evaluations_coach
  FOR INSERT
  TO authenticated
  WITH CHECK (
    coach_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('coach', 'admin')
    )
  );

-- Les coaches peuvent modifier leurs évaluations
CREATE POLICY "Coaches can update their evaluations"
  ON annual_evaluations_coach
  FOR UPDATE
  TO authenticated
  USING (
    coach_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('coach', 'admin')
    )
  )
  WITH CHECK (
    coach_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('coach', 'admin')
    )
  );

-- Les admins peuvent tout faire
CREATE POLICY "Admins can manage all coach evaluations"
  ON annual_evaluations_coach
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Créer un index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_annual_evaluations_coach_employee 
  ON annual_evaluations_coach(employee_id);
CREATE INDEX IF NOT EXISTS idx_annual_evaluations_coach_coach 
  ON annual_evaluations_coach(coach_id);
CREATE INDEX IF NOT EXISTS idx_annual_evaluations_coach_year 
  ON annual_evaluations_coach(year);
