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
        this.$emit("loaded", instance);
        this.pspdfkitWrapper.instance = instance;
        console.log('this.pspdfkitWrapper.instance ===> ', this.pspdfkitWrapper.instance);

        let toolbarItems = instance.toolbarItems;
        this.pspdfkitWrapper.toolbarItems = toolbarItems.map(v => ({...v, isSelected: true}));
        instance.setToolbarItems(this.pspdfkitWrapper.toolbarItems);

        instance.contentDocument.addEventListener("mouseup", this.contentDocumentMouseup);

        instance.addEventListener("textSelection.change", this.textSelectionChange);
        instance.addEventListener("annotations.load", this.annotationsLoad);
        instance.addEventListener("annotations.willChange", this.annotationsWillChange);
        instance.addEventListener("annotations.change", this.annotationsChange);
        instance.addEventListener("annotations.create", this.annotationsCreate);
        instance.addEventListener("annotations.update", this.annotationsUpdate);
        instance.addEventListener("annotations.delete", this.annotationsDelete);
        instance.addEventListener("annotations.press", this.annotationsPress);
        instance.addEventListener("annotations.blur", this.annotationsBlur);
        instance.addEventListener("annotations.focus", this.annotationsFocus);
      });
    },
    methods: {
      cardClicked(item) {
        item.metadata.isOpen = !item.metadata.isOpen;
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

      async loadPSPDFKit(container) {
        this.pspdfkitWrapper.PSPDFKit = PSPDFKit;
        PSPDFKit.unload(container);

        return PSPDFKit.load({
          ...this.pspdfkitWrapper.pspdfConfiguration,
          initialViewState: PSPDFKit.viewStateFromOpenParameters(new PSPDFKit.ViewState({ showToolbar: true }) )
        });
      },

      async textSelectionChange(textSelection) {
        if (textSelection) {
          this.currentTextSelection = {
            currentPageIndex: this.pspdfkitWrapper.instance.viewState.currentPageIndex,
          };

          let isPromiseSuccess = await this.resolveAllPromises([
            textSelection.getBoundingClientRect(),
            textSelection.getText()
          ], (values) => {
            this.currentTextSelection['rect'] = values[0].toJS();
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
          this.currentTextSelection['calculatedRect'] = rectsObject;

          let customMenu = this.generateMenuElement();
          let item = new this.pspdfkitWrapper.PSPDFKit.CustomOverlayItem({
            id: "custom-pspdfkit-tooltip-overlay",
            node: customMenu,
            pageIndex: this.pspdfkitWrapper.instance.viewState.currentPageIndex,
            position: new this.pspdfkitWrapper.PSPDFKit.Geometry.Point({
              x: rectsObject.left + rectsObject.width,
              y: rectsObject.top
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

      contentDocumentMouseup(event) {
        console.log('contentDocument mouseup ===> ', event);
      },

      annotationsLoad(loadedAnnotations) {
        console.log('annotations.load ===> ', loadedAnnotations);
      },

      annotationsWillChange(event) {
        if (event.reason === this.pspdfkitWrapper.PSPDFKit.AnnotationsWillChangeReason.DRAW_START) {
          console.log("The user is drawing...");
        }
      },

      annotationsChange() {
        console.log("Something in the annotations has changed.");
      },

      annotationsCreate(annotations) {
        console.log('annotations.create ===> ', annotations);
      },

      annotationsUpdate(annotations) {
        console.log('annotations.update ===> ', annotations);
        annotations.forEach(annotation => {
          const annotationById = this.getAnnotationById(annotation.id);
          const index = this.findAnnotationIndexById(annotation.id);

          this.pspdfkitWrapper.listOfAnnotation.splice(index, 1, {...annotationById, ...annotation.toJS()});
        });
      },

      annotationsDelete(annotations) {
        console.log('annotations.delete ===> ', annotations);
        annotations.forEach(annotation => {
          const annotationById = this.getAnnotationById(annotation.id);
          annotationById.metadata.isAttached = false;
        });
      },

      annotationsPress(event) {
        console.log('annotations.press ===> ', event);
      },

      annotationsBlur(event) {
        console.log('annotations.blur ===> ', event);
      },

      annotationsFocus(event) {
        if (event.annotation instanceof PSPDFKit.Annotations.TextAnnotation) {
          console.log('annotationsFocus ===> ', event.annotation.text);
        }
      },

      updateToolbar(item) {
        item.isSelected = !item.isSelected;
        this.pspdfkitWrapper.instance.setToolbarItems(this.pspdfkitWrapper.toolbarItems.filter((item) => item.isSelected));
      },

      async toggleAnnotation(selectedAnnotation, completeRemove = false) {
        if(selectedAnnotation.metadata.isAttached || completeRemove) {
          let annotation = await this.getNativeAnnotationById(selectedAnnotation.id);
          if(annotation) {
            await this.pspdfkitWrapper.instance.delete(annotation);
            selectedAnnotation.metadata.isAttached = false;
          }

          if(completeRemove) {
            this.pspdfkitWrapper.listOfAnnotation = this.pspdfkitWrapper.listOfAnnotation.filter(annotation => annotation.id !== selectedAnnotation.id);
          }
        } else {
          this.currentTextSelection = selectedAnnotation.metadata.currentTextSelection;
          this.onContextMenuSelection(selectedAnnotation.metadata.type, selectedAnnotation.id);
        }
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
        let pagesAnnotations = await Promise.all(
          Array.from({
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

      async onContextMenuSelection(action, id = null, fromAction = 'highlight') {
        let annotationsLength = this.pspdfkitWrapper.listOfAnnotation.length;
        let fieldsToPickFromExistingAnnotation = ['note', 'isEditable', 'isDeletable', 'opacity', 'noView'];
        let existingAnnotation = this.getAnnotationById(id) || null;
        let existingAnnotationParams = { id: id ? id : `highlight-${fromAction}-${annotationsLength}` };

        console.log('existingAnnotation ===> ', existingAnnotation);
        if(existingAnnotation) {
          fieldsToPickFromExistingAnnotation.forEach(field => {
            existingAnnotationParams[field] = existingAnnotation[field];
          });
        }

        switch (action) {
          case 'highlight': {
            var rects = this.pspdfkitWrapper.PSPDFKit.Immutable.List([
              new this.pspdfkitWrapper.PSPDFKit.Geometry.Rect(this.currentTextSelection.calculatedRect)
            ]);

            let params = {
              ...existingAnnotationParams,
              ...{ rects, color: this.getColorByAction(fromAction) }
            };

            let annotation = await this.createHighlightAnnotation(params);
            this.pspdfkitWrapper.instance.create(annotation);

            if(!id) {
              this.pspdfkitWrapper.listOfAnnotation.push({...annotation.toJS(), ...{
                metadata: {
                  isOpen: false,
                  isAttached: true,
                  currentTextSelection: this.currentTextSelection,
                  type: fromAction
                }
              }});
            } else {
              let temp = this.pspdfkitWrapper.listOfAnnotation.filter(annotation => annotation.id === id)[0];
              temp.metadata.isAttached = true;
            }
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

          default:
          console.log('This should never happen !!!');
          break;
        }

        console.log('this.getAllAnnotations ===> ', this.getAllAnnotations(), this.pspdfkitWrapper.listOfAnnotation);
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

      beforeUnmount() {
        this.pspdfkitWrapper.instance.contentDocument.removeEventListener("mouseup", this.contentDocumentMouseup);
        this.pspdfkitWrapper.instance.removeEventListener("textSelection.change", this.textSelectionChange);
        this.pspdfkitWrapper.instance.removeEventListener("annotations.load", this.annotationsLoad);
        this.pspdfkitWrapper.instance.removeEventListener("annotations.willChange", this.annotationsWillChange);
        this.pspdfkitWrapper.instance.removeEventListener("annotations.change", this.annotationsChange);
        this.pspdfkitWrapper.instance.removeEventListener("annotations.create", this.annotationsCreate);
        this.pspdfkitWrapper.instance.removeEventListener("annotations.update", this.annotationsUpdate);
        this.pspdfkitWrapper.instance.removeEventListener("annotations.delete", this.annotationsDelete);
        this.pspdfkitWrapper.instance.removeEventListener("annotations.press", this.annotationsPress);
        this.pspdfkitWrapper.instance.removeEventListener("annotations.blur", this.annotationsBlur);
        this.pspdfkitWrapper.instance.removeEventListener("annotations.focus", this.annotationsFocus);

        this.pspdfkitWrapper.PSPDFKit.unload(this.pspdfkitWrapper.pspdfConfiguration.container);
      }
    },
    unmounted() {
      console.log('unmounted ===> ', this.pspdfkitWrapper);
      alert('unmounted');
    }
  });
})();
