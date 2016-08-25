var fileapi_path = 'modules/fileAPI';window.FileAPI = {		debug: false // debug mode	,	cors: true 	,	staticPath: fileapi_path + '/js/FileAPI/' // path to *.swf	,	flashUrl: fileapi_path + '/js/FileAPI/FileAPI.flash.swf'	,	flashImageUrl: fileapi_path + '/js/FileAPI/FileAPI.flash.image.swf'};(function($){		"use strict";	var Plugin = function( elem, options ){			this.elem = elem;			this.$elem = $(elem);			this.options = options;			this.cache = {};			this.files = [];			this.index = 0;			this.queue = [];			this.active = false;			this.maxfiles = 0;			this.loadedfiles = 0;			this.cropper = {};			this.box = 'confirmBox';//crop popup		  }		;//	Array.prototype.reversedCopy = function(){//	   var arr = [];//	   for( var i = this.length; i--; ){//		   arr.push( this[i] );//	   };//	   return arr;//	};		// прототипируем конструктор	Plugin.prototype = {		defaults: {			txt:{},			preset: {}		},		init: function() {			// параметры по умолчанию, которые можно задать на старте			// или позже, через глобальный метод			var $this = this;						this.config = $.extend({}, this.defaults, this.options);			this.maxfiles = this.config.preset.maxfiles;			this.loadedfiles = this.config.preset.countloadedfiles;			this.config.preset.accept_list = $.parseJSON(this.config.preset.accept_list);			this.config.preset.extensions =  $.parseJSON($this.config.preset.extensions);			this.config.txt = this.config.preset.txt;			this.cropper.w = this.config.preset.imagetransform.original.width ? this.config.preset.imagetransform.original.width : 0;			this.cropper.h = this.config.preset.imagetransform.original.height ? this.config.preset.imagetransform.original.height : 0;								if( !(FileAPI.support.cors || FileAPI.support.flash) ){				this.$elem.find('.fapi-oooops').show();				this.$elem.find('.fapi-buttons-panel').hide();			}						/*Drag&drop*/			if( FileAPI.support.dnd && this.config.preset.dnd){								this.$elem.find('.fapi-drag-n-drop').show();				this.$elem.dnd(function (over){					$(this).find('.fapi-js-dropzone').toggle(over);				}, function (files){					$this.onFiles(files);				});			}						/*autoupload*/			if(this.config.preset.autoupload){				this.$elem.find('.fapi-js-start').hide();			}						/*hover button*/			this.$elem.on('mouseenter mouseleave', '.fapi-button', function (evt){				$(evt.currentTarget).toggleClass('fapi-button-hover', evt.type === 'mouseenter');			});						/*multiple*/			if((this.maxfiles - this.loadedfiles) > 1){				this.$elem.find('input.fipi-button-input').prop("multiple", this.config.preset.multiple);			}						/*accept*/			if(this.config.preset.accept){				this.$elem.find('input.fipi-button-input').prop("accept", this.config.preset.accept);			}						if(this.maxfiles >= this.loadedfiles){				$this._bind('cotFileAPI_changebox');			}					this.$elem			.on('change','input[type="file"]',this,function (evt){				var files = FileAPI.getFiles(evt);							evt.data.onFiles(files);					FileAPI.reset(evt.currentTarget);			})			.on('click','.fapi-js-del',this, function (evt) {				evt.preventDefault();				var id = $(this).attr('data-id');									if(id > 0){						evt.data._GetFile(id, 'delete');					}			})			.on('click','.fapi-js-start',this, function (evt) {				evt.preventDefault();				evt.data.start();			})					.on('click','.fapi-js-reset',this, function (evt) {				evt.preventDefault();				var 					el = $(evt.currentTarget).closest('.fapi-js-file')				,	uid = el.attr('id').split('-').pop()				,	file = evt.data._getFile_uid(uid)				;									evt.data.remove(file);					el.fadeOut(function(){						$(this).remove();						$this.queue.pop();						$this._bind('cotFileAPI_crop_done');					});			})				.on('click', '.fapi-js-abort',this, function (evt){									evt.preventDefault();					var el = $(evt.target).closest('.fapi-js-file');										evt.data.abort(el);								})			.on('click','.fapi_ajax',function (evt) {				evt.preventDefault();				var 					data = {}				,	block = $(this).attr('data-ajaxblock')				,	url = $(this).attr('data-url')				,	post_data = $(this).attr('data-post')				,	inp = $(this).attr('data-getval')				;									if(inp){						data.api_name = $('#' + inp + ' input[name="api_name"]').val();						data.api_id = $('#' + inp + ' input[name="api_id"]').val();					}					$.ajax({						type: post_data ? "POST":"GET",						url: url,						data: data,						success: function (msg) {							$('#' + block).html(msg);						}					});									return false;			})			.on('click','.fapi_editor_link',this,function (evt) {					evt.preventDefault();								var 						$this = evt.data					,	data = $.parseJSON($(this).attr('data'));										if(data.editor){						var 							link = $(this).attr('data-link')						,	insert = $.trim($this.tmpl($this.$elem.find('.fapi-file-tmpl-editor').html(), { data: data,link: link }));								if (CKEDITOR.instances[data.editor] != undefined) {								CKEDITOR.instances[data.editor].insertHtml(insert);							}else{								$('[name="'+data.editor+'"]').html(insert);							}					}					return false;				})			;			return this;		},		remove: function (file){						var uid = typeof file === 'object' ? FileAPI.uid(file) : file;			this.queue = FileAPI.filter(this.queue, function (file){ return FileAPI.uid(file) !== uid; });			this.loadedfiles--;			this._bind('cotFileAPI_changebox');					},		_getFile_uid: function (uid){						return FileAPI.filter(this.queue, function (file){ return FileAPI.uid(file) === uid; })[0];					},		_in_array: function(value, array) {						for(var i = 0; i < array.length; i++) 			{				if(array[i] === value) return true;			}			return false;					},		_popup_construct:function(replace){			var				$this = this			,	info = $this.cropper.info			,	file = $this.cropper.file			,	padtop = parseInt($('.fapi_popup_body').css("padding-top"))			,	padbot = parseInt($('.fapi_popup_body').css("padding-bottom"))					,	rside = $('.fapi_popup_body .rside').outerWidth()			,	rside_clr = $('.fapi_popup_body .rside').width()			,	pad = padtop + padbot + 20			,	marg_w = $(window).width() < 600 ? 10 :100			,	marg_h = $(window).height() < 600 ? 10 :100			,	$popup_w = (info.width + rside > $(window).width()- marg_w ? $(window).width() - marg_w: info.width + rside)			,	$popup_h = (info.height + pad > $(window).height()- marg_h ? $(window).height() - marg_h: info.height + pad)			,	$img = $('<img src="' + info.url + '" id="cropimg" >').css({						'max-width': $popup_w - rside +'px'					,	'max-height':$popup_h - pad  +'px' 				})			,	aspect = $this.cropper.w / $this.cropper.h			,	$previews = $('.imgprev').css({					'width': rside_clr +'px'				,	'height':rside_clr +'px'			});			;			$("#" + this.box).css({					'width': $popup_w +'px'				,	'height':$popup_h +'px'				,	'overflow': 'hidden'				,	'opacity':'0'				,	'margin-left': '-'+($popup_w / 2) + 'px'				,	'margin-top': '-'+($popup_h / 2) + 'px'			}).find('.fapi_popup_body .lside').css({					'width': 'calc(100% - '+rside+'px)'			});			$('#imagebox').empty().html($img);			$("#" + this.box).off('click', '[data-method]');			$("#" + this.box).on('click', '[data-method]', function () {				var 					$this = $(this)				,	data = $this.data()				; 								$img.cropper(data.method, data.option, data.secondOption).cropper('replace');							 });			if(!replace){				$img.cropper({					preview: $previews,					aspectRatio:aspect,					viewMode: 1,					dragMode: 'move',// crop					autoCropArea: 0.9,					restore: true,					guides: true,					highlight: false,					cropBoxMovable: true,					cropBoxResizable: true,					minCropBoxWidth:$this.cropper.w,					minCropBoxHeight:$this.cropper.h,					built:function(e){												var 							rside_h = $('.fapi_popup_body .rside').outerHeight() + pad / 2 						,	real_h = $("#" + $this.box).find('.cropper-container').outerHeight()						,	real_w = $("#" + $this.box).find('.cropper-container').outerWidth()						,	hh = real_h + (pad / 2)						,	hr = hh < rside_h ? rside_h : hh						;												$("#" + $this.box).hide().css({								'height':hr +'px'							,	'width': real_w + rside + pad/2 +'px'							,	'margin-top': '-'+(real_h + (pad / 2)) /2 + 'px'							,	'opacity':'1'}).fadeIn('fast');						},					crop: function(e) {						var 							flip = e.rotate % 180						,	flip270 = e.rotate === 270 || e.rotate === -90						,	flip180 = e.rotate === 180 || e.rotate === -180							,	flip90 = e.rotate === 90 || e.rotate === -270							,	ow = info.width						,	oh = info.height						,	x = e.x						,	y = e.y						;						if(flip270)						{							x = ow - (e.height + e.y);							y = e.x;						}							if(flip180)						{							x = ow - (e.width + e.x);							y = oh - (e.height + e.y);						}							if(flip90)						{							x = e.y;							y = oh - (e.width + e.x);						}												file.crop = {							x:x,							y:y,							w:flip ? e.height : e.width ,							h:flip ? e.width : e.height,							deg:e.rotate,							img: $img						};					}				 });			}else{				$img.cropper('replace');			}		},		onFiles:function (files){						/* Crop mode*/			if(this.config.preset.cropper && !!window.URL && URL.createObjectURL){				var file = files[0];				var $this = this;								if (this._isImageFile(file)){										/* проверка на размер файла */					if( file.size >= $this.config.preset.maxfilesize*FileAPI.MB ){						alert($this.config.txt.maximum_file_size + $this.config.preset.maxfilesize+'MB');						return;					}													FileAPI.getInfo(file,function (err, info){											if( !err ){														if(info.width >= $this.cropper.w && info.height >= $this.cropper.h){								var									url = URL.createObjectURL(file)								,	wfile = {}								,	tmp								;																$("#" + $this.box).remove();								$('body').prepend($this.tmpl($this.$elem.find('.fapi-popup-tmpl').html(), { box: $this.box }));								$("#" + $this.box).on('click', '.fapi-js-crop', function (){																		tmp = file.crop.img.cropper('getCroppedCanvas', {'width':$this.cropper.w, 'height':$this.cropper.h});									FileAPI.Image(tmp).resize($this.config.preset.preview_width, $this.config.preset.preview_height,$this.config.preset.preview_resize_type).get(function (err/**String*/, img/**HTMLElement*/){																				file.crop.res = img;									});																		wfile = FileAPI.Image(file);									wfile.rotate(file.crop.deg);									wfile.crop(file.crop.x , file.crop.y, file.crop.w, file.crop.h);									if($this.cropper.w > 0 && $this.cropper.h > 0){											if(file.crop.deg === 0 || file.crop.deg === 180 || file.crop.deg === -180){																						wfile.resize($this.cropper.w, $this.cropper.h );																					}else{																						wfile.resize($this.cropper.h, $this.cropper.w );																					}																				}																		if($this.config.preset.imagetransform.original.overlay){																				wfile.overlay($this.config.preset.imagetransform.original.overlay);									}																											$this._onFiles([wfile]);									$("#" + $this.box).jqmHide();																		$this.$elem.find('.fapi-js-select').hide();																	});																info.url = url;								$this.cropper.info = info;								$this.cropper.file = file;																$this._popup_construct();								$("#" + $this.box).jqm({									modal:false,									onHide: function(hash) { 										$('#cropimg').cropper('destroy');										hash.w.hide() && hash.o && hash.o.remove();												return true;																		}}).jqmShow(); 															}else{								alert($this.config.txt.small_img + ' '+$this.cropper.w +'x'+$this.cropper.h);							}										}else{							alert('Error image');						}					});									}else{					alert($this.config.txt.error_img);				}			}else{				this._onFiles(files);			}				},		_isImageFile: function (file) {			return /^image/.test(file.type);		},		_onFiles:function (files){								var						rev = files.length > 1				,	$Queue = $('<div/>').prependTo(this.$elem.find('.fapi-file-preview'))				,	$this = this				;								if(!$this.config.preset.autoupload){					this.active = true;				}								FileAPI.each(files, function (file){										var isfile = file.matrix ? file.file : file;					/* проверка на тип файла*/					if($this.config.preset.accept_list && !$this._in_array(isfile.type.split("/")[0], $this.config.preset.accept_list)) {						alert('This file type is not allowed (' + isfile.name + ')');						return;					}										/* проверка на допустимое расширение*/					isfile.ext = isfile.name.split(".").pop().toLowerCase();					if(!$this._in_array(isfile.ext,$this.config.preset.extensions)){						alert($this.config.txt.file_error_ext + '( *.' + isfile.ext + ' )' + $this.config.txt.file_error_ext2);						return;					}					/* проверка на размер файла */					if( isfile.size >= $this.config.preset.maxfilesize*FileAPI.MB ){						alert($this.config.txt.maximum_file_size + $this.config.preset.maxfilesize+'MB');					}					else if( isfile.size === void 0 ){						$this.$elem.find('.fapi-oooops').show();						$this.$elem.find('.fapi-buttons-panel').hide();					}					else {							$this.loadedfiles++;						if($this.maxfiles >= $this.loadedfiles){														if(rev){								$this.queue.unshift(file);							}else{								$this.queue.push(file);							}														$Queue.append($this.tmpl($this.$elem.find('.fapi-file-tmpl').html(), { file: isfile }));							$this.add(file, $this.config.preset.preview_width, $this.config.preset.preview_height,'auto');														if($this.config.preset.autoupload){																$this.start();							}													}else{														$this.loadedfiles--;							$this.$elem.find('.fapi-main-info:hidden').text($this.config.txt.maxfiles_limit).fadeIn().delay(3000).fadeOut();						}					}				});								if(!$this.config.preset.autoupload){					this.active = false;				}								$this._bind('cotFileAPI_changebox');		},		_bind:function (trigger){			$(document).trigger(trigger);			$(window).trigger(trigger);						if(this.config.preset.autoupload || trigger === 'cotFileAPI_crop_done'){								if( this.loadedfiles >= this.maxfiles){										this.$elem.find('.fapi-buttons-panel').hide();									}else{										this.$elem.find('.fapi-buttons-panel, .fapi-js-select').show();					}			}			if(this.queue.length === 0 ) {				this.$elem.find('.fapi-js-start').hide();			}else{				this.$elem.find('.fapi-js-start').show();			}						this.$elem.find('input.fipi-button-input').prop("multiple", (this.maxfiles - this.loadedfiles) <= 1 ? false :  this.config.preset.multiple);					},		add:function (file, width, height,rotate){			 			var $this = this;						if(file.matrix && file.file.crop.res){								$this._getEl(file,'.fapi-js-left')					.addClass('fapi-left-border')					.html(file.file.crop.res)				;				}			if( /^image/.test(file.type) ){				$this._getEl(file,'.fapi-process').text($this.config.txt.process).show();				FileAPI.Image(file).preview(width,height).rotate(rotate).get(function (err, img){					if( !err ){												$this._getEl(file,'.fapi-js-left')							.addClass('fapi-left-border')							.html(img)						;											}else{												alert(err);											}										$this._getEl(file,'.fapi-process').text($this.config.txt.select_done).show();									});							}else{								$this._getEl(file,'.fapi-process').text($this.config.txt.select_done).show();							}		},		_getEl: function (file, sel){					var $el = this.$elem.find('#file-'+FileAPI.uid( file.matrix ? file.file : file));			return	sel ? $el.find(sel) : $el;					},		start: function (){						if( !this.active && (this.active = this.queue.length > 0) ){								this._upload(this.queue.pop());			}					},		_upload: function (file){						if( file ){				var $this = this;				this.xhr = FileAPI.upload({					url: $this.config.preset.actionurl,					data:$this.config.preset.data,					files: { file: file },					imageAutoOrientation: true,					chunkSize: $this.config.preset.chunksize * FileAPI.MB,					chunkUploadRetry: 3,					imageOriginal: false,					imageTransform: $this.config.preset.imagetransform,					prepare:function (file, options){												$this._getEl(file,'.fapi-process').hide();						options.data.uid = FileAPI.uid(file);											},					upload: function (){												$this._getEl(file).addClass('fapi-file_upload');						$this._getEl(file, '.fapi-js-progress')							.css({ opacity: 0 }).show()							.animate({ opacity: 1 }, 100)						;											},					progress: function (evt){												$this._getEl(file, '.fapi-js-bar').css('width', evt.loaded/evt.total*100+'%');											},					complete: function (err, xhr){						if(!err && xhr.response){							var 								response = JSON.parse(xhr.response)							,	lastid = response.file_info.lastId							,	myerror = response.error							;													}						var state = err || myerror ? 'error' : 'done';												if(myerror){														err = myerror;							$this._getEl(file).delay($this.config.preset.timeviewerror).fadeOut(function(){$this._bind('cotFileAPI_changebox');});							$this._getEl(file).addClass('fapi-b-file-error');													}												if(myerror || err){														$this.loadedfiles--;													}												$this._getEl(file, '.fapi-js-progress').animate({ opacity: 0 }, 200, function (){														$(this).hide(); 							$this._getEl(file).removeClass('fapi-file_upload');													});												$this._getEl(file, '.fapi-js-info').append(', <b class="fapi-b-file__'+state+'">'+(err ?  err : state)+'</b>');												if(lastid > 0){														$this._GetFile(lastid,'view',$this._getEl(file)); 													}												$this.active = false;						$this.start();					}				});			}		},		abort: function (el){			if( this.active && this.xhr ){								this.xhr.abort();				var 					time = this.config.preset.timeviewerror				,	data = {}				;								data = this.config.preset.data;				data.delete_tmp_chunk = 1;				data.tmp_filename = this.xhr.files[0]['name'];				$.ajax({					type: "POST",					url: this.config.preset.actionurl,					data: data,					success: function (msg) {												if (msg === 'deleted_tmp') {							el.delay(time).fadeOut();						}											}				});			}				},		getFileById: function (id){						var i = this.files.length;						while( i-- ){								if( FileAPI.uid(this.files[i]) === id ){					var res = this.files[i];					return res;				}							}		},		_GetFile:function (id, action, widget) {			var 				data = {}			,	$this = this			;			data = this.config.preset.data;			data.id = id;			data.act = action;						$.ajax({				type: "POST",				url: this.config.preset.elementurl,				data: data,				success: function (msg) {												if (action === 'view') {												widget.replaceWith(msg);						$('#fapi_thumb_'+id+' .fapi_ok').show().delay(3000).fadeOut();						$this._bind('cotFileAPI_changebox');						if($this.config.preset.cropper){							$this._bind('cotFileAPI_crop_done');						}						return true;											}					if (action === 'delete' && msg === 'delete') {												$('#fapi_thumb_' + id).fadeOut();						$this.loadedfiles--;						$this._bind('cotFileAPI_changebox');						if($this.config.preset.cropper){							$this._bind('cotFileAPI_crop_done');						}						return true;											}									}			});		},		tmpl: function(str, data){			var fn = !/\W/.test(str) ?				this.cache[str] = cache[str] ||				this.tmpl(document.getElementById(str).innerHTML) :				new Function("obj",				  "var p=[],print=function(){p.push.apply(p,arguments);};" +				  "with(obj){p.push('" +				  str					.replace(/[\r\t\n]/g, " ")					.split("<%").join("\t")					.replace(/((^|%>)[^\t]*)'/g, "$1\r")					.replace(/\t=(.*?)%>/g, "',$1,'")					.split("\t").join("');")					.split("%>").join("p.push('")					.split("\r").join("\\'")				+ "');}return p.join('');");			return data ? fn( data ) : fn;					}	};	  Plugin.defaults = Plugin.prototype.defaults;  $.fn.cot_fileAPI = function(options) {	      return this.each(function() {		      new Plugin(this, options).init();	      });	  };})(jQuery);