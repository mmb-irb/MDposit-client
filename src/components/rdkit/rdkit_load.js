const RDKitHandler = {
    RDKit: null,
    async load() {
      if (this.RDKit) return this.RDKit; // Si ya está cargado, lo devuelve
  
      return new Promise((resolve, reject) => {
        if (window.RDKit) {
          // Si ya está definido en window, lo usamos
          this.RDKit = window.RDKit;
          resolve(window.RDKit);
          return;
        }
  
        const script = document.createElement("script");
        script.src = "https://unpkg.com/@rdkit/rdkit/dist/RDKit_minimal.js";
        script.async = true;
        script.onload = async () => {
          try {
            const RDKitModule = await window.initRDKitModule();
            console.log("✅ RDKit cargado:", RDKitModule.version());
            this.RDKit = RDKitModule;
            window.RDKit = RDKitModule; // Guardar en window para evitar recargas
            resolve(RDKitModule);
          } catch (error) {
            console.error("❌ Error al inicializar RDKit:", error);
            reject(error);
          }
        };
  
        script.onerror = () => reject(new Error("❌ No se pudo cargar el script de RDKit."));
        document.body.appendChild(script);
      });
    }
  };
  
  export default RDKitHandler;
  