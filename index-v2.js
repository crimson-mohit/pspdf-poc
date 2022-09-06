(() => {
  const COLORS = {
    'highlight': PSPDFKit.Color.YELLOW,
    'note': PSPDFKit.Color.RED,
    'comment': PSPDFKit.Color.ORANGE,
    'link': PSPDFKit.Color.PINK
  };

  new Vue({
    el: '#pspdfkit-app',
    props: {},
    data: {
      pspdfkitWrapper: {
        PSPDFKit: null,
        instance: null,
        pspdfConfiguration: {
          container: "#pspdfkit",
          document: "./assets/document-mark3.pdf",
          styleSheets: [
            "./assets/custom-pspdfkit.css"
          ],
          disableTextSelection: false
        },
        toolbarItems: [],
        listOfAnnotation: [],
        isContextMenuOpen: false,
        currentTextSelection: null
      },
      timer: 2
    },
    async mounted() {
      let timerInterval = setInterval(() => {
        this.timer = this.timer - 1;

        setTimeout(() => {
          this.timer = 0;
          clearInterval(timerInterval);
        }, (this.timer * 1000));
      }, 1000);

      await this.delay(this.timer-1 * 1000);

      this.loadPSPDFKit(this.pspdfkitWrapper.pspdfConfiguration.container).then(async (instance) => {
        console.log('this.pspdfkitWrapper.instance ===> ', instance);

        this.$emit("loaded", instance);
        this.pspdfkitWrapper.instance = instance;
        this.pspdfkitWrapper.listOfAnnotation = await this.getExportInstantJSON();
        console.log('this.pspdfkitWrapper.listOfAnnotation ===> ', this.pspdfkitWrapper.listOfAnnotation);

        // const state = instance.viewState;
        // const newState = state.set("enableAnnotationToolbar", false);
        // instance.setViewState(newState);

        let toolbarItems = instance.toolbarItems;
        this.pspdfkitWrapper.toolbarItems = toolbarItems.map(v => ({...v, isSelected: true}));
        instance.setToolbarItems(this.pspdfkitWrapper.toolbarItems);


        instance.contentDocument.addEventListener("mouseup", this.contentDocumentMouseupEvent);

        instance.addEventListener("textSelection.change", this.textSelectionChangeEvent);
        instance.addEventListener("annotations.load", this.annotationsLoadEvent);
        instance.addEventListener("annotations.willChange", this.annotationsWillChangeEvent);
        instance.addEventListener("annotations.change", this.annotationsChangeEvent);
        instance.addEventListener("annotations.create", this.annotationsCreateEvent);
        instance.addEventListener("annotations.update", this.annotationsUpdateEvent);
        instance.addEventListener("annotations.delete", this.annotationsDeleteEvent);
        instance.addEventListener("annotations.press", this.annotationsPressEvent);
        instance.addEventListener("annotations.blur", this.annotationsBlurEvent);
        instance.addEventListener("annotations.focus", this.annotationsFocusEvent);
        instance.addEventListener("annotations.willSave", this.annotationsWillSaveEvent);
        instance.addEventListener("annotations.didSave", this.annotationsDidSaveEvent);

        // instance.applyOperations([{
        //   type: "applyInstantJson",
        //   instantJSON: {
        //     annotations: [],
        //     format: "https://pspdfkit.com/instant-json/v1"
        //   }
        // }]);
      });
    },
    methods: {
      // utils
      async getExportInstantJSON() {
        let annotationsObject = await this.pspdfkitWrapper.instance.exportInstantJSON();
        console.log('annotationsObject ===> ', annotationsObject);
        return annotationsObject.annotations || [];
      },

      async putLocalStorage(key, value) {
        return Promise.resolve().then(function () {
          localStorage.setItem(key, value);
        });
      },

      async getLocalStorage(key) {
        return Promise.resolve().then(function () {
          return localStorage.getItem(key);
        });
      },

      cardClicked(item) {
        if(item.customData) {
          item.customData.isOpen = !item.customData.isOpen;
        }
      },

      delay(millisec) {
        return new Promise(resolve => {
          setTimeout(resolve, millisec);
        });
      },

      resolveAllPromises(promises, resolve, reject) {
        return Promise.all(promises)
        .then(resolve)
        .catch(reject);
      },

      async fetchJson(url) {
        try {
          const response = await fetch(url);
          return response.json();
        } catch (error) {
          console.log(error);
          return error;
        }
      },

      findAnnotationIndexById(id) {
        return this.pspdfkitWrapper.listOfAnnotation.findIndex(anno => anno.id === id);
      },

      getAnnotationById(id) {
        return this.pspdfkitWrapper.listOfAnnotation.filter(anno => anno.id === id)[0];
      },

      getColorByAction(action) {
        return COLORS[action];
      },

      async hasAnnotations() {
        let allAnnotations = await this.getAllAnnotations();
        let hasAnnotations = allAnnotations.length > 0;
        return hasAnnotations;
      },

      async getAllAnnotations(native = false) {
        let pagesAnnotations = await Promise.all(Array.from({
          length: this.pspdfkitWrapper.instance.totalPageCount
        }).map((_, pageIndex) =>
        this.pspdfkitWrapper.instance.getAnnotations(pageIndex)
        ));

        if(native) return pagesAnnotations;

        let allAnnotations = pagesAnnotations
        .map(pageList => pageList.toJS())
        .flat();

        return allAnnotations;
      },

      async getNativeAnnotationById(id) {
        let allAnnotations = await this.getAllAnnotations(true);

        let annotation = null;
        for(let i = 0, l = allAnnotations.length; i < l; i++) {
          for(let j = 0, len = allAnnotations[i].toJS().length; j < len; j++) {
            if(allAnnotations[i].toJS()[j].id === id) {
              annotation = allAnnotations[i].get(j);
              break;
            }
          }
        }
        return annotation;
      },

      async loadPSPDFKit(container) {
        this.pspdfkitWrapper.PSPDFKit = PSPDFKit;
        PSPDFKit.unload(container);

        let existingAnnotations = JSON.parse(await this.getLocalStorage('annotations')) || [];

        return PSPDFKit.load({
          ...this.pspdfkitWrapper.pspdfConfiguration,
          initialViewState: PSPDFKit.viewStateFromOpenParameters(new PSPDFKit.ViewState({ showToolbar: true }) ),
          instantJSON: {
            format: "https://pspdfkit.com/instant-json/v1",
            annotations: existingAnnotations
          }
        });
      },

      updateToolbar(item) {
        item.isSelected = !item.isSelected;
        this.pspdfkitWrapper.instance.setToolbarItems(this.pspdfkitWrapper.toolbarItems.filter((item) => item.isSelected));
      },

      generateMenuElement() {
        let customMenu = document.createElement("div");
        customMenu.onpointerup = e => {
          e.stopPropagation();
          this.isContextMenuOpen = false;
          this.pspdfkitWrapper.instance.removeCustomOverlayItem("custom-pspdfkit-tooltip-overlay");
          this.onContextMenuSelection(e.target.getAttribute('data-id'));
        }
        customMenu.className = "custom-pspdfkit-tooltip-overlay"
        customMenu.innerHTML = `
        <ul id="context-menu">
        <li data-id="highlight">Highlight</li>
        <li data-id="note">Note</li>
        <li data-id="comment">Comment</li>
        <li data-id="link">Link</li>
        <li data-id="copy">Copy</li>
        </ul>
        `;

        return customMenu;
      },

      async createHighlightAnnotation(params) {
        let annotation = new this.pspdfkitWrapper.PSPDFKit.Annotations.HighlightAnnotation({
          pageIndex: this.pspdfkitWrapper.instance.viewState.currentPageIndex,
          boundingBox: this.pspdfkitWrapper.PSPDFKit.Geometry.Rect.union(params.rects),
          isEditable: true,
          isDeletable: true,
          opacity: 0.7,
          noView: false, // hide annotation
          ...params, // overwrite fields
          rects: params.rects,
          color: params.color
        });

        return annotation;
      },

      async onContextMenuSelection(action, id = null, fromAction = 'highlight') {
        switch (action) {
          case 'highlight': {
            let annotationsLength = this.pspdfkitWrapper.listOfAnnotation.length;
            var rects = this.pspdfkitWrapper.PSPDFKit.Immutable.List([
              new this.pspdfkitWrapper.PSPDFKit.Geometry.Rect(this.currentTextSelection.rect)
            ]);

            let params = {
              id: `highlight-${fromAction}-${annotationsLength}`,
              rects,
              color: this.getColorByAction(fromAction),
              customData: {
                isOpen: false,
                currentTextSelection: this.currentTextSelection,
                type: fromAction
              }
            };

            let annotation = await this.createHighlightAnnotation(params);
            this.pspdfkitWrapper.instance.create(annotation);
          }
          break;

          case 'note': {
            this.onContextMenuSelection('highlight', id, 'note');
          }
          break;

          case 'comment': {
            this.onContextMenuSelection('highlight', id, 'comment');
          }
          break;

          case 'link': {
            this.onContextMenuSelection('highlight', id, 'link');
          }
          break;

          case 'copy': {
            navigator.clipboard.writeText(this.currentTextSelection.text);
            console.log('Text copied to clipboard');
          }
          break;

          default: {
            // this.onContextMenuSelection('highlight', id, 'unknown');
          }
          break;
        }
      },

      // actions
      setSelectedAnnotation(id) {
        this.pspdfkitWrapper.instance.setSelectedAnnotation(id);
      },
      async toggleAnnotationVisibility(id) {
        let annotation = await this.getNativeAnnotationById(id);
        const updatedAnnotation = annotation.set('noView', !annotation.get('noView'));
        await this.pspdfkitWrapper.instance.update(updatedAnnotation);
      },

      async deleteAnnotation(id) {
        let annotation = await this.getNativeAnnotationById(id);
        await this.pspdfkitWrapper.instance.delete(annotation);
      },

      // event callbacks
      async textSelectionChangeEvent(textSelection) {
        console.log('textSelection.change ===> ', textSelection);
        if (textSelection) {
          this.currentTextSelection = {};

          let isPromiseSuccess = await this.resolveAllPromises([
            textSelection.getBoundingClientRect(),
            textSelection.getText()
          ], (values) => {
            this.currentTextSelection['textRect'] = values[0].toJS();
            this.currentTextSelection['text'] = values[1];
            return true;
          }, (error) => {
            console.error('Promise.all error ===> ', error.message);
            return false;
          });

          if(!isPromiseSuccess) {
            this.currentTextSelection = null;
            return;
          }

          let rectsForPage = await textSelection.getSelectedRectsPerPage(this.pspdfkitWrapper.instance.viewState.currentPageIndex);

          let { rects } = rectsForPage.find((rectsPerPage) =>
          rectsPerPage.pageIndex === this.pspdfkitWrapper.instance.viewState.currentPageIndex
          );

          let rectsObject = this.pspdfkitWrapper.PSPDFKit.Geometry.Rect.union(rects).toJS();
          this.currentTextSelection['rect'] = rectsObject;

          const pageInfo = this.pspdfkitWrapper.instance.pageInfoForIndex(this.pspdfkitWrapper.instance.viewState.currentPageIndex)
          let contextMenuDimentions = {
            width: 80,
            height: 115
          };

          let customMenu = this.generateMenuElement();
          let item = new this.pspdfkitWrapper.PSPDFKit.CustomOverlayItem({
            id: "custom-pspdfkit-tooltip-overlay",
            node: customMenu,
            pageIndex: this.pspdfkitWrapper.instance.viewState.currentPageIndex,
            position: new this.pspdfkitWrapper.PSPDFKit.Geometry.Point({
              x: (rectsObject.left + rectsObject.width + contextMenuDimentions.width) > pageInfo.width ? (rectsObject.left - contextMenuDimentions.width) : rectsObject.left + rectsObject.width,
              y: (rectsObject.top + contextMenuDimentions.height) > pageInfo.height ? (rectsObject.top - contextMenuDimentions.height) : rectsObject.top
            }),
            onAppear: () => {
              console.log("custom menu appeared !!!");
            }
          });

          this.isContextMenuOpen = true;
          this.pspdfkitWrapper.instance.setCustomOverlayItem(item);
        } else {
          if(this.isContextMenuOpen) {
            setTimeout(() => { // throwing error without timeout
              this.pspdfkitWrapper.instance.removeCustomOverlayItem("custom-pspdfkit-tooltip-overlay");
            }, 0);
          }
        }
      },

      contentDocumentMouseupEvent(event) {
        console.log('contentDocument mouseup ===> ', event);
      },

      annotationsLoadEvent(loadedAnnotations) {
        console.log('annotations.load ===> ', loadedAnnotations);
      },

      annotationsWillChangeEvent(event) {
        if (event.reason === this.pspdfkitWrapper.PSPDFKit.AnnotationsWillChangeReason.DRAW_START) {
          console.log("The user is drawing...");
        }
      },

      annotationsChangeEvent() {
        console.log("Something in the annotations has changed.");
      },

      annotationsCreateEvent(annotations) {
        console.log('annotations.create ===> ', annotations);
        annotations.forEach(annotation => {
          this.pspdfkitWrapper.listOfAnnotation.push(this.pspdfkitWrapper.PSPDFKit.Annotations.toSerializableObject(annotation));

          if(!annotation.get('customData')) {
            let updatedAnnotation = annotation.set('customData', {
              isOpen: false,
              type: 'from/toolbar'
            });
            this.pspdfkitWrapper.instance.update(updatedAnnotation);
          }
        });
      },

      annotationsUpdateEvent(annotations) {
        console.log('annotations.update ===> ', annotations);
        annotations.forEach(annotation => {
          const index = this.findAnnotationIndexById(annotation.id);
          this.pspdfkitWrapper.listOfAnnotation.splice(index, 1, this.pspdfkitWrapper.PSPDFKit.Annotations.toSerializableObject(annotation));
        });
      },

      annotationsDeleteEvent(annotations) {
        console.log('annotations.delete ===> ', annotations);
        annotations.forEach(annotation => {
          const index = this.findAnnotationIndexById(annotation.id);
          this.pspdfkitWrapper.listOfAnnotation.splice(index, 1);
        });
      },

      annotationsPressEvent(event) {
        console.log('annotations.press ===> ', event);
      },

      annotationsBlurEvent(event) {
        console.log('annotations.blur ===> ', event);
      },

      annotationsFocusEvent(event) {
        if (event.annotation instanceof PSPDFKit.Annotations.TextAnnotation) {
          console.log('annotationsFocusEvent ===> ', event.annotation.text);
        }
      },

      annotationsWillSaveEvent(event) {
        console.log('annotations.willSave ===> ', event);
      },

      async annotationsDidSaveEvent(event) {
        console.log('annotations.didSave ===> ', event);
        let value = await this.getExportInstantJSON();
        await this.putLocalStorage('annotations', JSON.stringify(value));
      }
    },

    beforeUnmount() {
      this.pspdfkitWrapper.instance.contentDocument.removeEventListener("mouseup", this.contentDocumentMouseupEvent);
      this.pspdfkitWrapper.instance.removeEventListener("textSelection.change", this.textSelectionChangeEvent);
      this.pspdfkitWrapper.instance.removeEventListener("annotations.load", this.annotationsLoadEvent);
      this.pspdfkitWrapper.instance.removeEventListener("annotations.willChange", this.annotationsWillChangeEvent);
      this.pspdfkitWrapper.instance.removeEventListener("annotations.change", this.annotationsChangeEvent);
      this.pspdfkitWrapper.instance.removeEventListener("annotations.create", this.annotationsCreateEvent);
      this.pspdfkitWrapper.instance.removeEventListener("annotations.update", this.annotationsUpdateEvent);
      this.pspdfkitWrapper.instance.removeEventListener("annotations.delete", this.annotationsDeleteEvent);
      this.pspdfkitWrapper.instance.removeEventListener("annotations.press", this.annotationsPressEvent);
      this.pspdfkitWrapper.instance.removeEventListener("annotations.blur", this.annotationsBlurEvent);
      this.pspdfkitWrapper.instance.removeEventListener("annotations.focus", this.annotationsFocusEvent);
      this.pspdfkitWrapper.instance.removeEventListener("annotations.willSave", this.annotationsWillSaveEvent);
      this.pspdfkitWrapper.instance.removeEventListener("annotations.didSave", this.annotationsDidSaveEvent);

      this.pspdfkitWrapper.PSPDFKit.unload(this.pspdfkitWrapper.pspdfConfiguration.container);
    },

    unmounted() {
      console.log('unmounted ===> ', this.pspdfkitWrapper);
      alert('unmounted');
    }
  });
})();