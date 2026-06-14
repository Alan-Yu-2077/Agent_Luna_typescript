// Thin abstraction over a loaded pixi-live2d-display model — the TS port of
// Python js/runtime/model-driver.js. Writes Cubism parameters by id and manages
// the base position + drag offset. Typed loosely (the model carries its own
// bundled PIXI types) and guards unknown parameter ids.

type CoreModel = {
  setParameterValueById(id: string, value: number): void;
  _model?: { parameters?: { ids?: string[] } };
};

export type Live2DModelLike = {
  internalModel: { coreModel: CoreModel };
  scale: { set(value: number): void; x: number };
  position: { set(x: number, y: number): void };
  width: number;
  height: number;
};

export class ModelDriver {
  private readonly core: CoreModel;
  private readonly valid: Set<string>;
  private baseX = 0;
  private baseY = 0;

  constructor(private readonly model: Live2DModelLike) {
    this.core = model.internalModel.coreModel;
    this.valid = new Set(this.core._model?.parameters?.ids ?? []);
  }

  setParam(id: string, value: number): void {
    if (this.valid.size && !this.valid.has(id)) return;
    try {
      this.core.setParameterValueById(id, value);
    } catch {
      /* unknown id on this model — ignore */
    }
  }

  setScale(scale: number): void {
    this.model.scale.set(scale);
  }

  get width(): number {
    return this.model.width;
  }
  get height(): number {
    return this.model.height;
  }

  setBase(x: number, y: number): void {
    this.baseX = x;
    this.baseY = y;
    this.model.position.set(x, y);
  }

  setPositionOffset(dx: number, dy: number): void {
    this.model.position.set(this.baseX + dx, this.baseY + dy);
  }
}
