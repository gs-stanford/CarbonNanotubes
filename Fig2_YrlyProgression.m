%==========================================================================
% propertyprogress_specificstrength.m  (Excel-driven, new column order)
%==========================================================================

%% Clean up
clear; close all; clc;

%% Excel data source
dataFile = 'RadarFigureSource.xlsx';
sheet    = 'FibersStrengthYr';
range    = 'A1:E26';  % Year, CNTF_SPSTR, GF_SPSTR, CNTSH_SPSTR, GSH_SPSTR

assert(isfile(dataFile), 'Data file not found: %s', dataFile);

% Read table
T = readtable(dataFile, ...
    'Sheet', sheet, ...
    'Range', range, ...
    'ReadVariableNames', true, ...
    'TreatAsEmpty', {'', 'NA', 'NaN'});

% Normalize headers (in case of line breaks, spaces)
T.Properties.VariableNames = matlab.lang.makeValidName(T.Properties.VariableNames);

% Expected order in the sheet now:
%   Year | CNTF_SPSTR | GF_SPSTR | CNTSH_SPSTR | GSH_SPSTR
reqVars = ["Year","CNTF_SPSTR","GF_SPSTR","CNTSH_SPSTR","GSH_SPSTR"];
missingVars = setdiff(reqVars, string(T.Properties.VariableNames));
assert(isempty(missingVars), ...
    'Missing expected columns in Excel: %s', strjoin(missingVars, ', '));

% Extract columns
Year        = T.Year;
CNTF_SPSTR  = T.CNTF_SPSTR;
GF_SPSTR    = T.GF_SPSTR;
CNTSH_SPSTR = T.CNTSH_SPSTR;
GSH_SPSTR   = T.GSH_SPSTR;

%% Plot setup
cols = [ 65,105,225;   % royalblue
        255,165,  0;   % orange
        205, 92,  92;  % indianred
          0,128,128] / 255; % teal

markers = {'o','^','D','x'};
labels  = {'CNT Fibre','Graphene Fibre','CNT Sheet','Graphene Sheet'};

x_full = linspace(2013,2025.5,200);

fig = figure('Units','centimeters','Position',[5 5 12 12], ...
             'Color','none','InvertHardcopy','off');
hold on;

%% Scatter points (initial pass)
valid = ~isnan(CNTF_SPSTR);
scatter(Year(valid), CNTF_SPSTR(valid), 20, 'o', ...
        'MarkerEdgeColor',cols(1,1:3), 'MarkerFaceColor',cols(1,1:3), ...
        'DisplayName','CNT Fibre');

valid = ~isnan(GF_SPSTR);
scatter(Year(valid), GF_SPSTR(valid), 20, '*', ...
        'MarkerEdgeColor',cols(2,1:3), 'MarkerFaceColor',cols(2,1:3), ...
        'DisplayName','Graphene Fibre');

valid = ~isnan(CNTSH_SPSTR);
scatter(Year(valid), CNTSH_SPSTR(valid), 20, '^', ...
        'MarkerEdgeColor',cols(3,1:3), 'MarkerFaceColor',cols(3,1:3), ...
        'DisplayName','CNT Sheet');

valid = ~isnan(GSH_SPSTR);
scatter(Year(valid), GSH_SPSTR(valid), 20, 'x', ...
        'MarkerEdgeColor',cols(4,1:3), 'MarkerFaceColor',cols(4,1:3), ...
        'DisplayName','Graphene Sheet');

legend on

%%%%%%% Fits: linear for i=1:2; mean±1σ for i=3:4
allY = {CNTF_SPSTR, GF_SPSTR, CNTSH_SPSTR, GSH_SPSTR};
seriesLabels = {'CNT Fibre','Graphene Fibre','CNT Sheet','Graphene Sheet'};

for i = 1:4
    y = allY{i};
    valid = ~isnan(y);
    x = Year(valid);
    y = y(valid);

    c = cols(i,:);

    if i <= 2
        % Linear fit (degree 1) for CNT Fibre and Graphene Fibre
        p = polyfit(x, y, 1);
        trend = polyval(p, x_full);

        % Residuals / 1σ band
        y_pred = polyval(p, x);
        res  = y - y_pred;
        sres = std(res);

        % Trend line and band
        plot(x_full, trend, 'LineWidth', 3, 'Color', c);
        fill([x_full, fliplr(x_full)], ...
             [trend - sres, fliplr(trend + sres)], ...
             c, 'FaceAlpha', 0.2, 'EdgeColor', 'none');
        plot(x_full, trend - sres, '--', 'LineWidth', 1, 'Color', c);
        plot(x_full, trend + sres, '--', 'LineWidth', 1, 'Color', c);

        % R^2 report
        SS_res = sum((y - y_pred).^2);
        SS_tot = sum((y - mean(y)).^2);
        R2 = 1 - SS_res/SS_tot;
        fprintf('R^2 for %s trendline: %.4f (slope = %.4f per year)\n', ...
                 seriesLabels{i}, R2, p(1));
    else
        % Mean ± 1σ for CNT Sheet and Graphene Sheet
        ym = mean(y);
        ys = std(y);
        const = ym * ones(size(x_full));

        plot(x_full, const, 'LineWidth', 3, 'Color', c);
%        fill([x_full, fliplr(x_full)], ...
%             [const - ys, fliplr(const + ys)], ...
%             c, 'FaceAlpha', 0.2, 'EdgeColor', 'none');
%        plot(x_full, const - ys, '--','LineWidth',1,'Color',c);
%        plot(x_full, const + ys, '--','LineWidth',1,'Color',c);
    end

    % Scatter points for this series
%    scatter(x, y, 20, 'Marker', markers{i}, ...
%            'MarkerEdgeColor', [0 0 0], 'MarkerFaceColor', 'none', ...
%            'DisplayName', seriesLabels{i});
end

%% Final styling
xlim([2013.5, 2025.5]);
ylim([0, 6.5]);
xlabel('Year','FontSize',11,'FontName','Helvetica');
ylabel('Specific Strength (GPa/SG)','FontSize',11,'FontName','Helvetica');
%legend(labels,'FontSize',11,'Location','best');
set(gca, ...
    'LineWidth', 1, ...               % Border thickness
    'TickDir', 'in', ...              % Tick direction
    'TickLength', [0.015 0.005], ...  % Major and minor tick length
    'FontSize', 11, ...               % Tick label font size
    'FontName', 'Helvetica', ...       % Font family
    'Color','none',...
    'Box','on'...
);


% Tight layout
set(gca,'LooseInset', max(get(gca,'TightInset'), 0.02));

% Save as SVG at 900 dpi
%print(gcf, 'Fig2_StrengthProgress0.svg', '-dsvg', '-r900');

hold off;

