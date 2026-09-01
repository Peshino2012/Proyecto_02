-- AlterTable: agregar categoryColors (con backfill desde color existente)
ALTER TABLE "Event" ADD COLUMN     "categoryColors" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Habit" ADD COLUMN     "categoryColors" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Task" ADD COLUMN     "categoryColors" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Task" ADD COLUMN     "stats" "TaskStat"[] DEFAULT ARRAY[]::"TaskStat"[];

-- Backfill: cada fila existente tenía exactamente una categoría (su color/stat actual)
UPDATE "Event" SET "categoryColors" = ARRAY["color"];
UPDATE "Habit" SET "categoryColors" = ARRAY["color"];
UPDATE "Task" SET "categoryColors" = ARRAY["color"], "stats" = ARRAY["stat"];

-- Ahora que los datos están migrados, sacamos el viejo campo single-stat
ALTER TABLE "Task" DROP COLUMN "stat";

-- UserProgress: los stats pasan a Float para poder repartir el +1 diario
-- entre varias categorías (ej. 2 categorías = +0.5 c/u)
ALTER TABLE "UserProgress" ALTER COLUMN "intelecto" SET DEFAULT 0,
ALTER COLUMN "intelecto" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "disciplina" SET DEFAULT 0,
ALTER COLUMN "disciplina" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "espiritu" SET DEFAULT 0,
ALTER COLUMN "espiritu" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "vitalidad" SET DEFAULT 0,
ALTER COLUMN "vitalidad" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "fuerza" SET DEFAULT 0,
ALTER COLUMN "fuerza" SET DATA TYPE DOUBLE PRECISION;
